const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss        = require('xss-clean');
const path       = require('path');
const fs         = require('fs');
const http       = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Ensure upload directories exist before anything else
['uploads/items', 'uploads/kyc'].forEach(dir => {
    const full = path.join(__dirname, dir);
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// Import routes
const authRoutes         = require('./routes/authRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const userRoutes         = require('./routes/userRoutes');
const loanRoutes         = require('./routes/loanRoutes');
const walletRoutes       = require('./routes/walletRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes         = require('./routes/chatRoutes');
const itemRoutes         = require('./routes/itemRoutes');

const app    = express();
const server = http.createServer(app);

// Socket.io setup — real-time messaging + live updates
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Make io globally accessible so controllers can emit events
global.io = io;

const Message = require('./models/Message');

io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.id);

    // User registers themselves with their userId
    socket.on('register', (userId) => {
        socket.join(userId);
        socket.join('global'); // global room for item market updates
        console.log(`User ${userId} joined room`);
    });

    // Load message history for a conversation from DB
    socket.on('load_messages', async ({ userId, peerId }) => {
        try {
            const key = [userId, peerId].sort().join('_');
            const msgs = await Message.find({ conversationKey: key })
                .sort({ createdAt: 1 })
                .limit(200)
                .lean();
            const shaped = msgs.map(m => ({
                id:         m._id.toString(),
                senderId:   m.senderId.toString(),
                senderName: m.senderName,
                receiverId: m.receiverId.toString(),
                text:       m.text,
                timestamp:  m.createdAt.toISOString()
            }));
            socket.emit('message_history', { peerId, messages: shaped });
        } catch (err) {
            console.error('load_messages error:', err);
            socket.emit('message_history', { peerId, messages: [] });
        }
    });

    // Send a message — only allowed if chat request is accepted
    socket.on('send_message', async ({ senderId, senderName, receiverId, text }) => {
        try {
            const ChatRequest = require('./models/ChatRequest');
            const allowed = await ChatRequest.findOne({
                $or: [
                    { from: senderId, to: receiverId, status: 'accepted' },
                    { from: receiverId, to: senderId,  status: 'accepted' },
                ]
            }).catch(() => null);
            if (!allowed) {
                socket.emit('error_message', { message: 'Chat not accepted yet.' });
                return;
            }
            const key = [senderId, receiverId].sort().join('_');
            const saved = await Message.create({
                senderId, senderName, receiverId,
                text, conversationKey: key
            });
            const msg = {
                id:         saved._id.toString(),
                senderId,
                senderName,
                receiverId,
                text,
                timestamp:  saved.createdAt.toISOString(),
            };
            io.to(senderId).emit('new_message', msg);
            io.to(receiverId).emit('new_message', msg);
        } catch (err) {
            console.error('send_message error:', err);
            socket.emit('error_message', { message: 'Failed to send message.' });
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected:', socket.id);
    });
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(xss());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',          authRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/loans',         loanRoutes);
app.use('/api/wallet',        walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/items',         itemRoutes);

app.get('/health', (_req, res) => res.json({ success: true, message: 'Server is running', timestamp: new Date() }));

app.use('*', (_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Something went wrong!', error: process.env.NODE_ENV === 'development' ? err.message : {} });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/points_lending')
    .then(() => {
        console.log('✅ Connected to MongoDB');
        server.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`🔌 Socket.io enabled for real-time updates`);
        });
    })
    .catch((err) => { console.error('❌ MongoDB error:', err); process.exit(1); });

process.on('unhandledRejection', (err) => { console.error('Unhandled:', err); process.exit(1); });

module.exports = app;
