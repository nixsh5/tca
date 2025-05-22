// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Temporary local storage
const jwt = require('jsonwebtoken');

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.user = decoded.user; // Attach user info to socket
        next();
    });
});


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const userSockets = {}; // { socket.id: { username, room } }
const usernameToSocket = {}; // { username: socket.id }

const app = express();
app.use(cors());
app.use(express.json());

// Basic test route
app.get('/', (req, res) => {
    res.send('Backend is running');
});

// --- Authentication Route ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.role
                    }
                });
            }
        );
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).send('Server error');
    }
});

// --- Media Upload Route ---
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'chat-images',
        });
        res.json({ url: result.secure_url });
    } catch (err) {
        console.error('Cloudinary upload error:', err);
        res.status(500).json({ msg: 'Upload failed' });
    }
});

// --- List all rooms (for /listrooms command) ---
app.get('/api/rooms', async (req, res) => {
    const rooms = await Room.find({}, 'name');
    res.json(rooms.map(r => r.name));
});

// --- MongoDB connection ---
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Socket.io setup ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// --- Socket.io connection handler ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // --- Logout ---
    socket.on('logout', () => {
        if (userSockets[socket.id]) {
            const { room, username } = userSockets[socket.id];
            if (room) {
                socket.to(room).emit('room-users', getUsersInRoom(room).filter(u => u !== username));
            }
            delete usernameToSocket[username];
            delete userSockets[socket.id];
        }
    });

    // --- Join room with access control, user mapping, and history ---
    socket.on('join-room', async ({ room, username }) => {
        const roomDoc = await Room.findOne({ name: room });
        if (!roomDoc) {
            socket.emit('join-room-error', { msg: 'Room does not exist.' });
            return;
        }
        if (!roomDoc.allowedUsers.includes(username)) {
            socket.emit('join-room-error', { msg: 'You are not allowed to join this room.' });
            return;
        }
        // Leave previous room if any
        if (userSockets[socket.id]?.room) {
            socket.leave(userSockets[socket.id].room);
        }
        socket.join(room);
        userSockets[socket.id] = { username, room };
        usernameToSocket[username] = socket.id;
        socket.emit('join-room-success', { room });

        // Fetch last 20 messages for the room, sorted oldest to newest
        const history = await Message.find({ room }).sort({ timestamp: 1 }).limit(20);
        socket.emit('room-history', history);

        io.to(room).emit('room-users', getUsersInRoom(room));
    });

    // --- Leave room ---
    socket.on('leave-room', ({ room, username }) => {
        if (userSockets[socket.id] && userSockets[socket.id].room === room) {
            socket.leave(room);
            delete userSockets[socket.id].room; // Remove room from userSockets
            io.to(room).emit('room-users', getUsersInRoom(room).filter(u => u !== username));
        }
    });

    // --- Room message ---
    socket.on('room-message', async (data) => {
        // data: { room, msg, user }
        if (userSockets[socket.id]?.room === data.room) {
            await Message.create({
                from: data.user,
                room: data.room,
                text: data.msg
            });
            io.to(data.room).emit('room-message', data);
        }
    });

    // --- Direct message (DM) ---
    socket.on('dm', async (data) => {
        // data: { to, from, msg }
        const targetSocketId = usernameToSocket[data.to];
        if (targetSocketId) {
            await Message.create({
                from: data.from,
                to: data.to,
                text: data.msg
            });
            io.to(targetSocketId).emit('dm', data);
            socket.emit('dm', data); // echo to sender
        } else {
            socket.emit('dm-error', { msg: `User ${data.to} is not online.` });
        }
    });

    // --- DM history ---
    socket.on('get-dm-history', async ({ user1, user2 }) => {
        const history = await Message.find({
            $or: [
                { from: user1, to: user2 },
                { from: user2, to: user1 }
            ]
        }).sort({ timestamp: 1 }).limit(20);
        socket.emit('dm-history', history);
    });

    // --- List users in room ---
    socket.on('get-users', ({ room }) => {
        socket.emit('users-list', getUsersInRoom(room));
    });

    // --- Helper: get users in a room ---
    function getUsersInRoom(room) {
        return Object.values(userSockets)
            .filter(u => u.room === room)
            .map(u => u.username);
    }

    // --- Handle disconnect ---
    socket.on('disconnect', () => {
        const user = userSockets[socket.id];
        if (user && user.room) {
            socket.to(user.room).emit('room-users', getUsersInRoom(user.room).filter(u => u !== user.username));
            delete usernameToSocket[user.username];
        }
        delete userSockets[socket.id];
        console.log('User disconnected:', socket.id);
    });

    // --- Example: Listen for a test event ---
    socket.on('test', (msg) => {
        console.log('Test event received:', msg);
        socket.emit('test-reply', 'Hello from backend!');
    });
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
