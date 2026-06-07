// models/LoginAttempt.js
const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: String,
    success: {
        type: Boolean,
        default: false
    },
    attempts: {
        type: Number,
        default: 1
    },
    lockedUntil: {
        type: Date,
        default: null
    },
    lastAttemptAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for cleanup and queries
loginAttemptSchema.index({ email: 1, ipAddress: 1 });
loginAttemptSchema.index({ lockedUntil: 1 }, { expireAfterSeconds: 0 });

// Check if account is locked
loginAttemptSchema.methods.isLocked = function() {
    return this.lockedUntil && this.lockedUntil > new Date();
};

// Increment attempt count
loginAttemptSchema.methods.incrementAttempt = function() {
    this.attempts += 1;
    this.lastAttemptAt = new Date();
    
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3;
    if (this.attempts >= maxAttempts) {
        const timeoutMinutes = parseInt(process.env.LOGIN_TIMEOUT_MINUTES) || 15;
        this.lockedUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000);
    }
};

// Reset attempts on successful login
loginAttemptSchema.methods.reset = function() {
    this.attempts = 0;
    this.lockedUntil = null;
    this.success = true;
};

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);