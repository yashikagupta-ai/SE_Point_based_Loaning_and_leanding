// models/ChatRequest.js
const mongoose = require('mongoose');

const chatRequestSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending'
    },
    message: {
        type: String,
        default: '',
        maxlength: 200
    },
    itemTitle: {
        type: String,
        default: '',
        maxlength: 200
    }
}, {
    timestamps: true
});

// Prevent duplicate pending requests between same pair
chatRequestSchema.index({ from: 1, to: 1 }, { unique: false });

module.exports = mongoose.model('ChatRequest', chatRequestSchema);
