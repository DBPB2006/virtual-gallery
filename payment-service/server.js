const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./src/config/db');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
    console.log(`[PAYMENT-SERVICE] Active on Port ${PORT}`);
});
