// models/Loan.js
const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
    loanRequest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LoanRequest',
        required: true
    },
    borrower: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    principal: {
        type: Number,
        required: true
    },
    interestRate: {
        type: Number,
        required: true
    },
    interestAccrued: {
        type: Number,
        default: 0
    },
    totalRepayable: {
        type: Number,
        required: true
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'repaid', 'defaulted', 'cancelled'],
        default: 'active'
    },
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    dueDate: {
        type: Date,
        required: true
    },
    completedDate: Date,
    lastInterestCalculation: {
        type: Date,
        default: Date.now
    },
    repaymentHistory: [{
        amount: Number,
        date: Date,
        transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction'
        }
    }],
    isLate: {
        type: Boolean,
        default: false
    },
    latePenaltyApplied: {
        type: Boolean,
        default: false
    },
    latePenaltyAmount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Calculate current outstanding
loanSchema.virtual('outstanding').get(function() {
    return this.totalRepayable - this.amountPaid;
});

// Check if overdue
loanSchema.virtual('isOverdue').get(function() {
    return new Date() > this.dueDate && this.status === 'active';
});

// Method to calculate interest
loanSchema.methods.calculateInterest = function() {
    const now = new Date();
    const daysSinceLastCalc = Math.floor((now - this.lastInterestCalculation) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastCalc > 0) {
        const dailyInterest = this.principal * (this.interestRate / 100) / 365;
        const newInterest = dailyInterest * daysSinceLastCalc;
        this.interestAccrued += newInterest;
        this.totalRepayable = this.principal + this.interestAccrued;
        this.lastInterestCalculation = now;
    }
};

// Apply late penalty
loanSchema.methods.applyLatePenalty = function() {
    if (this.isOverdue && !this.latePenaltyApplied) {
        const penaltyRate = parseFloat(process.env.LATE_PENALTY_RATE) || 0.05;
        this.latePenaltyAmount = this.outstanding * penaltyRate;
        this.totalRepayable += this.latePenaltyAmount;
        this.latePenaltyApplied = true;
    }
};

module.exports = mongoose.model('Loan', loanSchema);