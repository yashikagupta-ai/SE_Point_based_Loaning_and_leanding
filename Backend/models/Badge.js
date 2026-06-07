// models/Badge.js
const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['lender', 'borrower', 'repayment', 'special', 'achievement'],
        required: true
    },
    criteria: {
        type: {
            type: String,
            enum: ['count', 'streak', 'amount', 'special'],
            required: true
        },
        threshold: Number,
        description: String
    },
    pointsReward: {
        type: Number,
        default: 0
    },
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary'],
        default: 'common'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Predefined badges
badgeSchema.statics.getPredefinedBadges = function() {
    return [
        {
            name: 'Trusted Lender',
            description: 'Consistently lend points to reliable borrowers',
            icon: '🏦',
            category: 'lender',
            criteria: { type: 'count', threshold: 10 },
            rarity: 'rare'
        },
        {
            name: 'On-time Repayer',
            description: 'Never missed a repayment deadline',
            icon: '⏰',
            category: 'repayment',
            criteria: { type: 'streak', threshold: 5 },
            rarity: 'epic'
        },
        {
            name: 'First Loan',
            description: 'Completed your first loan successfully',
            icon: '🌟',
            category: 'achievement',
            criteria: { type: 'count', threshold: 1 },
            rarity: 'common'
        }
    ];
};

module.exports = mongoose.model('Badge', badgeSchema);