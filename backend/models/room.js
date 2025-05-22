const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    allowedUsers: [{ type: String, required: true }], // usernames allowed in this room
});

module.exports = mongoose.model('Room', roomSchema);
