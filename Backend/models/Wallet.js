// models/Wallet.js
const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        required: true,
        default: 100, // Signup bonus
        min: 0
    },
    lockedBalance: {
        type: Number,
        default: 0, // Points in active loans
        min: 0
    },
    totalEarned: {
        type: Number,
        default: 0
    },
    totalSpent: {
        type: Number,
        default: 0
    },
    lastTransactionAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Virtual for available balance
walletSchema.virtual('availableBalance').get(function() {
    return this.balance - this.lockedBalance;
});

// Method to check if sufficient balance
walletSchema.methods.hasSufficientBalance = function(amount) {
    return this.availableBalance >= amount;
};

// Method to add points
walletSchema.methods.addPoints = function(amount, description) {
    this.balance += amount;
    this.totalEarned += amount;
    this.lastTransactionAt = new Date();
};

// Method to deduct points
walletSchema.methods.deductPoints = function(amount, description) {
    if (!this.hasSufficientBalance(amount)) {
        throw new Error('Insufficient balance');
    }
    this.balance -= amount;
    this.totalSpent += amount;
    this.lastTransactionAt = new Date();
};

module.exports = mongoose.model('Wallet', walletSchema);