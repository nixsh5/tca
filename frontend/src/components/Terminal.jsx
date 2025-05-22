import React, { useLayoutEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io } from 'socket.io-client';
import 'xterm/css/xterm.css';

const fileInputRef = React.createRef();
const backendUrl = 'https://tca-production-2b84.up.railway.app'; // <-- HARDCODED BACKEND URL

const Terminal = () => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const socketRef = useRef(null);

    const state = useRef({
        loggedIn: false,
        username: '',
        currentRoom: '',
        inDM: false,
        dmUser: '',
        token: null,
    });

    function isImageUrl(url) {
        return /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        fetch(`${backendUrl}/api/upload`, {
            method: 'POST',
            body: formData
        })
            .then(async res => {
                if (!res.ok) throw new Error('Upload failed');
                return res.json();
            })
            .then(data => {
                if (data.url) {
                    if (state.current.inDM) {
                        socketRef.current.emit('dm', {
                            to: state.current.dmUser,
                            from: state.current.username,
                            msg: data.url
                        });
                        xtermRef.current.write(`[DM to ${state.current.dmUser}]: [Image] ${data.url}\r\n`);
                    } else if (state.current.currentRoom) {
                        socketRef.current.emit('room-message', {
                            room: state.current.currentRoom,
                            user: state.current.username,
                            msg: data.url
                        });
                        xtermRef.current.write(`[${state.current.currentRoom}] ${state.current.username}: [Image] ${data.url}\r\n`);
                    } else {
                        xtermRef.current.write('Join a room or start a DM to send images.\r\n');
                    }
                } else {
                    xtermRef.current.write('Image upload failed.\r\n');
                }
                event.target.value = '';
            })
            .catch(() => {
                xtermRef.current.write('Image upload failed.\r\n');
                event.target.value = '';
            });
    }

    useLayoutEffect(() => {
        if (!terminalRef.current) return;

        xtermRef.current = new XTerm({
            cursorBlink: true,
            fontFamily: 'monospace',
            fontSize: 16,
            theme: {
                background: '#1e1e1e',
                foreground: '#00ff00'
            }
        });
        fitAddonRef.current = new FitAddon();
        xtermRef.current.loadAddon(fitAddonRef.current);

        const container = terminalRef.current;
        xtermRef.current.open(container);
        fitAddonRef.current.fit();
        xtermRef.current.focus();

        let inputBuffer = '';

        const getPrompt = () => {
            if (state.current.inDM) {
                return `[DM:${state.current.dmUser}] > `;
            } else if (state.current.currentRoom) {
                return `[${state.current.currentRoom}] > `;
            } else if (state.current.loggedIn) {
                return `[${state.current.username}] > `;
            }
            return '> ';
        };
        const writePrompt = () => {
            xtermRef.current.write(getPrompt());
        };

        writePrompt();

        function handleCommand(cmd) {
            const [command, ...args] = cmd.split(' ');
            let isAsyncCommand = false;

            switch (command) {
                case '/help':
                    xtermRef.current.write(
                        'Available commands:\r\n' +
                        '/help - Show this help\r\n' +
                        '/login <username> <password> - Login\r\n' +
                        '/listrooms - List available rooms\r\n' +
                        '/join <room> - Join a room\r\n' +
                        '/users - List users in current room\r\n' +
                        '/dm <username> - Start direct message\r\n' +
                        '/exit - Exit DM or leave room\r\n' +
                        '/image - Upload and send an image\r\n' +
                        '/logout - Logout\r\n' +
                        '/quit - Quit the app\r\n'
                    );
                    break;
                case '/login':
                    isAsyncCommand = true;
                    if (state.current.loggedIn) {
                        xtermRef.current.write('Already logged in.\r\n');
                        writePrompt();
                    } else if (args.length < 2) {
                        xtermRef.current.write('Usage: /login <username> <password>\r\n');
                        writePrompt();
                    } else {
                        const username = args[0];
                        const password = args[1];
                        fetch(`${backendUrl}/api/auth/login`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ username, password }),
                        })
                            .then(async res => {
                                let body = null;
                                try {
                                    body = await res.json();
                                } catch (e) {
                                    body = {};
                                }
                                return { status: res.status, body };
                            })
                            .then(({ status, body }) => {
                                if (status === 200 && body.token) {
                                    state.current.loggedIn = true;
                                    state.current.username = body.user.username;
                                    state.current.token = body.token;
                                    xtermRef.current.write(`Logged in as ${body.user.username}\r\n`);
                                    // Create socket connection with JWT
                                    socketRef.current = io(backendUrl, {
                                        auth: { token: body.token }
                                    });
                                    setupSocketListeners();
                                } else {
                                    xtermRef.current.write(`Login failed: ${body.msg || 'Invalid credentials'}\r\n`);
                                }
                                writePrompt();
                            })
                            .catch(err => {
                                console.error('Login API error:', err);
                                xtermRef.current.write('Login error. Check console.\r\n');
                                writePrompt();
                            });
                    }
                    break;
                case '/listrooms':
                    isAsyncCommand = true;
                    fetch(`${backendUrl}/api/rooms`)
                        .then(async res => {
                            if (!res.ok) throw new Error('Failed to fetch rooms');
                            return res.json();
                        })
                        .then(rooms => {
                            xtermRef.current.write('Available rooms: ' + rooms.join(', ') + '\r\n');
                            writePrompt();
                        })
                        .catch(err => {
                            xtermRef.current.write('Could not fetch rooms.\r\n');
                            writePrompt();
                        });
                    break;
                case '/join':
                    if (!state.current.loggedIn) {
                        xtermRef.current.write('Please login first.\r\n');
                    } else if (args.length < 1) {
                        xtermRef.current.write('Usage: /join <room>\r\n');
                    } else {
                        socketRef.current.emit('join-room', { room: args[0], username: state.current.username });
                    }
                    break;
                case '/users':
                    if (!state.current.loggedIn || !state.current.currentRoom) {
                        xtermRef.current.write('Join a room first.\r\n');
                    } else {
                        socketRef.current.emit('get-users', { room: state.current.currentRoom });
                    }
                    break;
                case '/dm':
                    if (!state.current.loggedIn) {
                        xtermRef.current.write('Please login first.\r\n');
                    } else if (args.length < 1) {
                        xtermRef.current.write('Usage: /dm <username>\r\n');
                    } else {
                        const targetUser = args[0];
                        state.current.inDM = true;
                        state.current.dmUser = targetUser;
                        xtermRef.current.write(`[DM with ${targetUser} started]\r\n`);
                        socketRef.current.emit('get-dm-history', {
                            user1: state.current.username,
                            user2: targetUser
                        });
                    }
                    break;
                case '/exit':
                    if (state.current.inDM) {
                        state.current.inDM = false;
                        state.current.dmUser = '';
                        xtermRef.current.write('Exited DM.\r\n');
                    } else if (state.current.currentRoom) {
                        socketRef.current.emit('leave-room', {
                            room: state.current.currentRoom,
                            username: state.current.username
                        });
                        state.current.currentRoom = '';
                        xtermRef.current.write('Left the room.\r\n');
                    } else {
                        xtermRef.current.write('Nothing to exit.\r\n');
                    }
                    break;
                case '/image':
                    if (!state.current.loggedIn) {
                        xtermRef.current.write('Please login first.\r\n');
                    } else {
                        fileInputRef.current.click();
                    }
                    break;
                case '/logout':
                    if (!state.current.loggedIn) {
                        xtermRef.current.write('Not logged in.\r\n');
                    } else {
                        socketRef.current.emit('logout');
                        state.current.loggedIn = false;
                        state.current.username = '';
                        state.current.currentRoom = '';
                        state.current.inDM = false;
                        state.current.dmUser = '';
                        state.current.token = null;
                        xtermRef.current.write('Logged out.\r\n');
                    }
                    break;
                case '/quit':
                    xtermRef.current.write('Thank you for using Terminal Chat! (mock quit)\r\n');
                    break;
                default:
                    xtermRef.current.write(`Unknown command: ${command}\r\nType /help for list of commands.\r\n`);
            }
            if (!isAsyncCommand) {
                writePrompt();
            }
        }

        function handleMessage(msg) {
            if (!state.current.loggedIn) {
                xtermRef.current.write('Please login to send messages.\r\n');
                return;
            }
            if (state.current.inDM) {
                if (isImageUrl(msg)) {
                    xtermRef.current.write(`[DM to ${state.current.dmUser}]: [Image] ${msg}\r\n`);
                } else {
                    xtermRef.current.write(`[DM to ${state.current.dmUser}]: ${msg}\r\n`);
                }
            } else if (state.current.currentRoom) {
                if (isImageUrl(msg)) {
                    xtermRef.current.write(`[${state.current.currentRoom}] ${state.current.username || 'You'}: [Image] ${msg}\r\n`);
                } else {
                    xtermRef.current.write(`[${state.current.currentRoom}] ${state.current.username || 'You'}: ${msg}\r\n`);
                }
            } else {
                xtermRef.current.write('Join a room or start a DM to send messages.\r\n');
            }
        }

        function setupSocketListeners() {
            const socket = socketRef.current;
            if (!socket) return;

            // Remove existing listeners to prevent duplicates
            socket.off('room-message');
            socket.off('dm');
            socket.off('join-room-success');
            socket.off('join-room-error');
            socket.off('users-list');
            socket.off('room-users');
            socket.off('room-history');
            socket.off('dm-history');

            // Room messages
            socket.on('room-message', (data) => {
                if (data.user !== state.current.username) {
                    if (isImageUrl(data.msg)) {
                        xtermRef.current.write(`\r\n[${data.room}] ${data.user}: [Image] ${data.msg}\r\n`);
                    } else {
                        xtermRef.current.write(`\r\n[${data.room}] ${data.user}: ${data.msg}\r\n`);
                    }
                    writePrompt();
                }
            });

            // Direct messages
            socket.on('dm', (data) => {
                if (data.to === state.current.username) {
                    if (isImageUrl(data.msg)) {
                        xtermRef.current.write(`\r\n[DM from ${data.from}]: [Image] ${data.msg}\r\n`);
                    } else {
                        xtermRef.current.write(`\r\n[DM from ${data.from}]: ${data.msg}\r\n`);
                    }
                    writePrompt();
                }
            });

            // Room join events
            socket.on('join-room-success', ({ room }) => {
                state.current.currentRoom = room;
                state.current.inDM = false;
                state.current.dmUser = '';
                xtermRef.current.write(`Joined room: ${room}\r\n`);
                socket.emit('get-users', { room });
                writePrompt();
            });
            socket.on('join-room-error', ({ msg }) => {
                xtermRef.current.write(`Join room failed: ${msg}\r\n`);
                writePrompt();
            });

            // Users list
            socket.on('users-list', (users) => {
                xtermRef.current.write(`Users in room: ${users.join(', ')}\r\n`);
                writePrompt();
            });

            // Real-time user list updates
            socket.on('room-users', (users) => {
                xtermRef.current.write(`\r\n[Updated] Users in room: ${users.join(', ')}\r\n`);
                writePrompt();
            });

            // Room history
            socket.on('room-history', (messages) => {
                messages.forEach(msg => {
                    if (isImageUrl(msg.text)) {
                        xtermRef.current.write(`[${msg.room}] ${msg.from}: [Image] ${msg.text}\r\n`);
                    } else {
                        xtermRef.current.write(`[${msg.room}] ${msg.from}: ${msg.text}\r\n`);
                    }
                });
                writePrompt();
            });

            // DM history
            socket.on('dm-history', (messages) => {
                messages.forEach(msg => {
                    const direction = msg.from === state.current.username ? 'to' : 'from';
                    const other = direction === 'to' ? msg.to : msg.from;
                    if (isImageUrl(msg.text)) {
                        xtermRef.current.write(`[DM ${direction} ${other}]: [Image] ${msg.text}\r\n`);
                    } else {
                        xtermRef.current.write(`[DM ${direction} ${other}]: ${msg.text}\r\n`);
                    }
                });
                writePrompt();
            });
        }

        xtermRef.current.onKey(({ key, domEvent }) => {
            if (domEvent.key === 'Enter') {
                const promptText = getPrompt();
                const totalLength = promptText.length + inputBuffer.length;
                xtermRef.current.write('\r' + ' '.repeat(totalLength) + '\r');

                const trimmedInput = inputBuffer.trim();
                inputBuffer = '';

                if (trimmedInput.length > 0) {
                    if (trimmedInput.startsWith('/')) {
                        handleCommand(trimmedInput);
                    } else {
                        handleMessage(trimmedInput);
                        if (state.current.loggedIn && socketRef.current) {
                            if (state.current.inDM) {
                                socketRef.current.emit('dm', {
                                    to: state.current.dmUser,
                                    msg: trimmedInput,
                                    from: state.current.username
                                });
                            } else if (state.current.currentRoom) {
                                socketRef.current.emit('room-message', {
                                    room: state.current.currentRoom,
                                    msg: trimmedInput,
                                    user: state.current.username
                                });
                            }
                        }
                        writePrompt();
                    }
                } else {
                    writePrompt();
                }
            } else if (domEvent.key === 'Backspace') {
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    xtermRef.current.write('\b \b');
                }
            } else if (
                domEvent.key.length === 1 &&
                !domEvent.ctrlKey &&
                !domEvent.metaKey
            ) {
                inputBuffer += key;
                xtermRef.current.write(key);
            }
        });

        const handleClick = () => xtermRef.current.focus();
        container.addEventListener('click', handleClick);

        const handleResize = () => fitAddonRef.current.fit();
        window.addEventListener('resize', handleResize);

        return () => {
            xtermRef.current?.dispose();
            if (container) container.removeEventListener('click', handleClick);
            window.removeEventListener('resize', handleResize);
            if (socketRef.current) {
                socketRef.current.off('room-message');
                socketRef.current.off('dm');
                socketRef.current.off('join-room-success');
                socketRef.current.off('join-room-error');
                socketRef.current.off('users-list');
                socketRef.current.off('room-users');
                socketRef.current.off('room-history');
                socketRef.current.off('dm-history');
            }
        };
    }, []);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#1e1e1e' }}>
            {/* Hidden file input for image uploads */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileUpload}
            />
            {/* Terminal container */}
            <div
                ref={terminalRef}
                style={{
                    width: '100vw',
                    height: '100vh',
                    background: '#1e1e1e'
                }}
                tabIndex={0}
            />
        </div>
    );
};

export default Terminal;
