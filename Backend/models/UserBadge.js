// models/UserBadge.js
const mongoose = require('mongoose');

const userBadgeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    badge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge',
        required: true
    },
    earnedAt: {
        type: Date,
        default: Date.now
    },
    progress: {
        current: Number,
        target: Number,
        percentage: Number
    },
    isNotified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound index to ensure user can't earn same badge twice
userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });

// Method to update progress
userBadgeSchema.methods.updateProgress = function(current) {
    if (this.progress) {
        this.progress.current = current;
        this.progress.percentage = (current / this.progress.target) * 100;
        
        if (this.progress.percentage >= 100) {
            this.earnedAt = new Date();
        }
    }
};

module.exports = mongoose.model('UserBadge', userBadgeSchema);