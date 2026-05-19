const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./src/config/db');

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        const PORT = process.env.PORT || 5002;
        app.listen(PORT, () => {
            console.log(`[PAYMENT-SERVICE] Active on Port ${PORT}`);
        });
    } catch (err) {
        console.error(`[PAYMENT-SERVICE][FATAL] Failed to start server: ${err.message}`);
        process.exit(1);
    }
};

startServer();

