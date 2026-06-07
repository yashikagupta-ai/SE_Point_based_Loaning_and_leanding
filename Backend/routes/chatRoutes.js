// routes/chatRoutes.js
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ChatRequest        = require('../models/ChatRequest');
const User               = require('../models/User');
const createNotification = require('../utils/createNotification');

router.use(protect);

// POST /api/chat/request — send a chat request
router.post('/request', async (req, res) => {
    try {
        const { toUserId, message, itemTitle } = req.body;
        if (!toUserId) return res.status(400).json({ success: false, message: 'toUserId required' });
        if (toUserId === req.user.id) return res.status(400).json({ success: false, message: 'Cannot request yourself' });

        const toUser = await User.findById(toUserId).select('name email');
        if (!toUser) return res.status(404).json({ success: false, message: 'User not found' });

        // Check if a pending/accepted request already exists
        const existing = await ChatRequest.findOne({
            $or: [
                { from: req.user.id, to: toUserId, status: { $in: ['pending', 'accepted'] } },
                { from: toUserId, to: req.user.id, status: { $in: ['pending', 'accepted'] } },
            ]
        });
        if (existing) {
            return res.status(400).json({ success: false, message: existing.status === 'accepted' ? 'Chat already active' : 'Request already pending' });
        }

        const fromUser = await User.findById(req.user.id).select('name');
        const cr = await ChatRequest.create({ from: req.user.id, to: toUserId, message: message || '', itemTitle: itemTitle || '' });

        // Notify the recipient about the chat/negotiate request
        const itemPart = itemTitle ? ` regarding "${itemTitle}"` : '';
        await createNotification({
            user:    toUserId,
            type:    'negotiate_request',
            title:   '💬 New Chat Request',
            message: `${fromUser?.name || 'Someone'} wants to negotiate with you${itemPart}.`,
            relatedId:    cr._id,
            relatedModel: null
        });

        res.status(201).json({ success: true, data: cr });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/chat/requests/incoming — pending requests sent TO me
router.get('/requests/incoming', async (req, res) => {
    try {
        const requests = await ChatRequest.find({ to: req.user.id, status: 'pending' })
            .populate('from', 'name email')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/chat/requests/outgoing — requests I sent
router.get('/requests/outgoing', async (req, res) => {
    try {
        const requests = await ChatRequest.find({ from: req.user.id })
            .populate('to', 'name email')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/chat/request/:id/accept
router.post('/request/:id/accept', async (req, res) => {
    try {
        const cr = await ChatRequest.findById(req.params.id).populate('from', 'name email');
        if (!cr) return res.status(404).json({ success: false, message: 'Request not found' });
        if (cr.to.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
        if (cr.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already handled' });
        cr.status = 'accepted';
        await cr.save();
        res.json({ success: true, data: cr });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/chat/request/:id/decline
router.post('/request/:id/decline', async (req, res) => {
    try {
        const cr = await ChatRequest.findById(req.params.id);
        if (!cr) return res.status(404).json({ success: false, message: 'Request not found' });
        if (cr.to.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
        cr.status = 'declined';
        await cr.save();
        res.json({ success: true, data: cr });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/chat/contacts — users I can chat with (accepted requests both ways)
router.get('/contacts', async (req, res) => {
    try {
        const accepted = await ChatRequest.find({
            $or: [
                { from: req.user.id, status: 'accepted' },
                { to: req.user.id,   status: 'accepted' },
            ]
        }).populate('from', 'name email _id').populate('to', 'name email _id');

        const contacts = accepted.map(cr => {
            const peer = cr.from._id.toString() === req.user.id ? cr.to : cr.from;
            return { peerId: peer._id.toString(), peerName: peer.name, peerEmail: peer.email };
        });
        res.json({ success: true, data: contacts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/chat/unread — returns the last message createdAt for each contact conversation.
// The client uses this to detect messages that arrived while it was offline.
router.get('/unread', async (req, res) => {
    try {
        const Message = require('../models/Message');
        const userId = req.user.id;

        // Get all accepted contacts
        const accepted = await ChatRequest.find({
            $or: [
                { from: userId, status: 'accepted' },
                { to: userId,   status: 'accepted' },
            ]
        }).populate('from', 'name _id').populate('to', 'name _id');

        const results = await Promise.all(accepted.map(async (cr) => {
            const peer = cr.from._id.toString() === userId ? cr.to : cr.from;
            const peerId = peer._id.toString();
            const key = [userId, peerId].sort().join('_');

            // Get the last message in this conversation
            const lastMsg = await Message.findOne({ conversationKey: key })
                .sort({ createdAt: -1 })
                .select('senderId text createdAt')
                .lean();

            return {
                peerId,
                peerName: peer.name,
                lastMessage: lastMsg ? {
                    senderId: lastMsg.senderId.toString(),
                    text: lastMsg.text,
                    createdAt: lastMsg.createdAt.toISOString(),
                } : null,
            };
        }));

        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


module.exports = router;
