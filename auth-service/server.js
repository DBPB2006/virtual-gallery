const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./src/config/db');
const seedAdmin = require('./src/config/seed');

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Run Admin Seeder/Healer
        await seedAdmin();

        const PORT = process.env.PORT || 5001;
        app.listen(PORT, () => {
            console.log(`[AUTH-SERVICE] Active on Port ${PORT}`);
        });
    } catch (err) {
        console.error(`[AUTH-SERVICE][FATAL] Failed to start server: ${err.message}`);
        process.exit(1);
    }
};

startServer();
