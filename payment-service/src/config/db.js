const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/virtual_exhibition');
        console.log(`Payment DB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Payment DB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
