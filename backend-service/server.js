const dotenv = require('dotenv');
dotenv.config();
const app = require('./app');
const connectDB = require('./src/config/db');
const seedAdmin = require('./src/config/seed');
const http = require('http');
const { Server } = require("socket.io");

const server = http.createServer(app);

const cleanOrigin = (url) => {
    if (!url) return 'http://localhost:5173';
    return url.replace(/\/$/, '');
};

const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
    'https://angling-curly-pretext.ngrok-free.dev'
]);

if (process.env.CLIENT_URL) {
    allowedOrigins.add(cleanOrigin(process.env.CLIENT_URL));
}
if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(o => allowedOrigins.add(cleanOrigin(o.trim())));
}

const socketCorsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const originClean = cleanOrigin(origin);
        if (allowedOrigins.has(originClean)) {
            return callback(null, true);
        }
        const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(originClean) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(originClean);
        const isNgrok = /\.ngrok-free\.dev$/.test(originClean) || /\.ngrok\.io$/.test(originClean);
        const isEC2 = /^http(s)?:\/\/ec2-.*\.compute(-1)?\.amazonaws\.com(:\d+)?$/.test(originClean) || 
                      /^http(s)?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(originClean);
        if (isLocalhost || isNgrok || isEC2) {
            return callback(null, true);
        }
        callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true
};

const io = new Server(server, {
    cors: socketCorsOptions
});

// Socket Authentication Middleware via shared session store
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(app.sessionMiddleware));

io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.user) {
        socket.user = session.user;
        next();
    } else {
        next(new Error("unauthorized"));
    }
});

// Presence Tracking
const exhibitPresence = {}; // { exhibitId: [ { userId, name, socketId } ] }

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.user.name} (${socket.id})`);

    socket.on("join-exhibit", (exhibitId) => {
        socket.join(`exhibit_${exhibitId}`);

        // Update Presence
        if (!exhibitPresence[exhibitId]) exhibitPresence[exhibitId] = [];

        const existingSession = exhibitPresence[exhibitId].find(u => u.userId === socket.user.id);
        if (!existingSession) {
            exhibitPresence[exhibitId].push({
                userId: socket.user.id,
                name: socket.user.name,
                socketId: socket.id
            });
        }

        // Emit presence update to room
        io.to(`exhibit_${exhibitId}`).emit("presence-update", exhibitPresence[exhibitId]);

        console.log(`User ${socket.user.name} joined exhibit ${exhibitId}`);
    });

    socket.on("send-message", ({ exhibitId, message }) => {
        io.to(`exhibit_${exhibitId}`).emit("receive-message", {
            id: Date.now(),
            sender: socket.user.name,
            text: message,
            timestamp: new Date()
        });
    });

    socket.on("disconnect", () => {
        // Remove user from all presence lists
        for (const [exhibitId, users] of Object.entries(exhibitPresence)) {
            const index = users.findIndex(u => u.socketId === socket.id);
            if (index !== -1) {
                users.splice(index, 1);
                io.to(`exhibit_${exhibitId}`).emit("presence-update", users);
            }
        }
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

const startServer = async () => {
    await connectDB();
    await seedAdmin();

    const PORT = process.env.PORT || 5050;
    server.listen(PORT, () => {
        
    });
};

startServer();
