// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'borrow_request',       // lender gets this when someone requests their item
            'borrow_approved',      // borrower gets this when their request is approved
            'borrow_rejected',      // borrower gets this when their request is rejected
            'item_returned',        // lender gets this when item is returned
            'loan_approved',        // borrower gets this when points loan is approved
            'loan_repayment',       // borrower gets this as repayment reminder
            'loan_overdue',         // borrower gets this when loan is overdue
            'negotiate_request',    // recipient gets this when someone wants to negotiate
            'badge_earned',         // user gets this when they earn a badge
            'system'                // generic system notification
        ],
        required: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 120
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },
    isRead: {
        type: Boolean,
        default: false
    },
    // Optional link to related resource
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    relatedModel: {
        type: String,
        enum: ['ItemListing', 'Loan', 'LoanRequest', 'User', null],
        default: null
    }
}, {
    timestamps: true
});

// Index to efficiently query unread notifications per user
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
