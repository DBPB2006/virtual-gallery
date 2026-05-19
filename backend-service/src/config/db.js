const mongoose = require('mongoose');

// Establishes a connection to the MongoDB database using environmental configuration
const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/virtual_exhibition';
    try {
        console.log(`[BACKEND-DB] Attempting connection to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}`);
        const conn = await mongoose.connect(mongoUri);
        const dbName = conn.connection.db.databaseName;
        console.log(`[BACKEND-DB][SUCCESS] Connected successfully to host: ${conn.connection.host}, database: ${dbName}`);

        // Explicitly pre-create collections so they show up immediately in Compass
        const collections = ['users', 'exhibitions', 'orders', 'sessions', 'notifications', 'contactrequests', 'verificationcodes'];
        for (const col of collections) {
            try {
                await conn.connection.db.createCollection(col);
                console.log(`[BACKEND-DB] Collection '${col}' verified/created in database '${dbName}'`);
            } catch (e) {
                if (e.code !== 48) { // 48 is NamespaceExists error (fine if exists)
                    console.error(`[BACKEND-DB][WARN] Error verifying/creating collection '${col}':`, e.message);
                }
            }
        }
    } catch (error) {
        console.error(`[BACKEND-DB][FATAL] MongoDB Connection Failure: ${error.message}`);
        process.exit(1); // Exit process with failure
    }
};

module.exports = connectDB;

