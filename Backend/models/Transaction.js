// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true,
        default: () => 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    },
    type: {
        type: String,
        enum: [
            'loan_created',
            'loan_repayment',
            'interest_earned',
            'penalty_applied',
            'bonus_earned',
            'points_purchased',
            'points_withdrawn',
            'points_transfer',
            'item_borrow_escrow',
            'item_borrow_payment',
            'item_borrow_refund'
        ],
        required: true
    },
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    fromWallet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet'
    },
    toWallet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet'
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    balanceAfter: {
        type: Number
    },
    description: {
        type: String,
        required: true
    },
    reference: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'referenceModel'
    },
    referenceModel: {
        type: String,
        enum: ['Loan', 'LoanRequest', 'User']
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'completed'
    },
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemListing',
        default: null
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    ipAddress: String,
    userAgent: String
}, {
    timestamps: true
});

// Index for faster queries
transactionSchema.index({ fromUser: 1, toUser: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 }, { unique: true });

// Encrypt sensitive data before saving
transactionSchema.pre('save', function(next) {
    // Add any pre-save logic here
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);