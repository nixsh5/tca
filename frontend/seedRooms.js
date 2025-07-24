require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('./models/Room');

const rooms = [
    { name: 'general', allowedUsers: ['nish', 'test', 'test2', 'test3'] },
    { name: 'dev', allowedUsers: ['nish'] },
];

async function seedRooms() {
    await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    for (let roomData of rooms) {
        const exists = await Room.findOne({ name: roomData.name });
        if (exists) {
            await Room.updateOne({ name: roomData.name }, { $set: { allowedUsers: roomData.allowedUsers } });
            console.log(`Room ${roomData.name} updated.`);
        } else {
            await Room.create(roomData);
            console.log(`Room ${roomData.name} created.`);
        }
    }

    mongoose.connection.close();
}

seedRooms();
