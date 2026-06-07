// models/LoanRequest.js
const mongoose = require('mongoose');

const loanRequestSchema = new mongoose.Schema({
    borrower: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemName: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true,
        maxlength: [100, 'Item name cannot exceed 100 characters']
    },
    amount: {
        type: Number,
        required: [true, 'Points amount is required'],
        min: [10, 'Minimum points is 10'],
        max: [10000, 'Maximum points is 10000']
    },
    purpose: {
        type: String,
        required: [true, 'Item description is required'],
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },
    duration: {
        type: Number, // in days
        required: [true, 'Repayment duration is required'],
        min: [1, 'Minimum duration is 1 day'],
        max: [365, 'Maximum duration is 365 days']
    },
    interestRate: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
        default: 'pending'
    },
    lender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 7*24*60*60*1000) // 7 days expiry
    },
    creditScoreAtRequest: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// Auto-expire pending requests
loanRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to approve loan
loanRequestSchema.methods.approve = async function(lenderId) {
    this.status = 'approved';
    this.lender = lenderId;
    this.approvedAt = new Date();
    await this.save();
};

// Method to reject loan
loanRequestSchema.methods.reject = function(reason) {
    this.status = 'rejected';
    this.rejectionReason = reason;
    this.rejectedAt = new Date();
};

module.exports = mongoose.model('LoanRequest', loanRequestSchema);