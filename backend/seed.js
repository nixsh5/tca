require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const users = [
    { username: 'abc', password: 'pass1'},
    { username: 'xyz', password: 'pass2'},
    // users can be added with username and passwords
];

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    for (let userData of users) {
        // Check if user already exists
        const exists = await User.findOne({ username: userData.username });
        if (exists) {
            console.log(`User ${userData.username} already exists, skipping.`);
            continue;
        }
        // Hash password
        userData.password = await bcrypt.hash(userData.password, 10);
        await User.create(userData);
        console.log(`User ${userData.username} created.`);
    }

    mongoose.connection.close();
}

seed().catch(err => {
    console.error(err);
    mongoose.connection.close();
});
