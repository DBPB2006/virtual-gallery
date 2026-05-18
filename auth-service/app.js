const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo').default;
const path = require('path');
const authRoutes = require('./src/routes/authRoutes');
const verificationRoutes = require('./src/routes/verificationRoutes');

const app = express();

const cleanOrigin = (url) => {
    if (!url) return 'http://localhost:5173';
    return url.replace(/\/$/, '');
};

app.use(cors({
    origin: cleanOrigin(process.env.CLIENT_URL),
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve static profile pictures
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Shared express session configuration (Session State is distributed in MongoDB)
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'dev_fallback_secret_auth_long_string_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/virtual_exhibition',
        collectionName: 'sessions'
    }),
    cookie: {
        httpOnly: true,
        secure: false, // Set to true in HTTPS environments
        maxAge: 1000 * 60 * 60 * 24 // 1 day session life
    }
});

app.use(sessionMiddleware);

app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    next();
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);

app.get('/health', (req, res) => {
    res.json({ service: "auth-service", status: "healthy" });
});

module.exports = app;
