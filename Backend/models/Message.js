// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName:  { type: String, required: true },
    receiverId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text:        { type: String, required: true, maxlength: 2000 },
    conversationKey: { type: String, required: true, index: true }  // sorted "uid1_uid2"
}, { timestamps: true });

messageSchema.index({ conversationKey: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
