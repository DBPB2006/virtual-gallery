const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo').default;
const path = require('path');

const app = express();

// Trust proxy is critical behind reverse proxies (Nginx, ngrok, AWS ALB)
app.set('trust proxy', 1);

const isProd = process.env.NODE_ENV === 'production';

// Simple CORS setup: allows local, EC2 public IP domain, and client URL from env
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://100.31.194.101:5173',
    process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost') || origin.endsWith('.ngrok-free.dev') || origin.endsWith('.ngrok.io')) {
            callback(null, true);
        } else {
            console.warn(`[CORS][BLOCKED] Origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.options('*', cors()); // Enable preflight handling

app.use(express.json());
app.use(cookieParser());

// Expose static media gallery folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Clean and simple express session configuration
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'vg_s3ss10n_k3y_Pr3mBhuvan_2006_Secure!XYZ',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/virtual_exhibition',
        collectionName: 'sessions'
    }),
    cookie: {
        httpOnly: true,
        secure: isProd, // Secure in production HTTPS
        sameSite: isProd ? 'none' : 'lax', // Lax in dev, None in prod HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
});

app.use(sessionMiddleware);
app.sessionMiddleware = sessionMiddleware;

app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    next();
});

// Register core business routers
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/exhibitions', require('./src/routes/exhibitionRoutes'));
app.use('/api/exhibitor', require('./src/routes/exhibitorRoutes'));
app.use('/api/notifications', require('./src/routes/notificationRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/contact', require('./src/routes/contactRoutes'));

app.get('/health', (req, res) => {
    res.json({ service: "backend-service", status: "healthy" });
});

module.exports = app;
