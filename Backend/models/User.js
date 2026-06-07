// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
        validate: {
            validator: function(v) {
                // Allow both student and admin Mahindra University emails
                return v.endsWith('@mahindrauniversity.edu.in') ||
                       v.endsWith('@mahindrauniveristy.edu.in');
            },
            message: 'Only Mahindra University email IDs are allowed'
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isKYCVerified: {
        type: Boolean,
        default: false
    },
    kycDocument: {
        type: String,
        default: null
    },
    studentId: {
        type: String,
        default: null,
        unique: true,        // enforced at DB level
        sparse: true         // allows multiple nulls; uniqueness only checked for non-null values
    },
    kycExtractedName: {
        type: String,
        default: null
    },
    kycUniversity: {
        type: String,
        default: null
    },
    creditScore: {
        type: Number,
        default: process.env.BASE_CREDIT_SCORE || 500,
        min: 300,
        max: 900
    },
    lendingCapacity: {
        type: Number,
        default: 1000, // Default points
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: null
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    tier: {
        type: String,
        enum: ['Bronze', 'Silver', 'Gold'],
        default: 'Bronze'
    },
    totalLent: {
        type: Number,
        default: 0
    },
    totalBorrowed: {
        type: Number,
        default: 0
    },
    timelyRepayments: {
        type: Number,
        default: 0
    },
    lateRepayments: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
        this.password = await bcrypt.hash(this.password, salt);
        this.passwordChangedAt = Date.now();
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user is admin
userSchema.methods.isAdmin = function() {
    return this.role === 'admin';
};

// Update tier based on activity
userSchema.methods.updateTier = function() {
    const totalTransactions = this.totalLent + this.totalBorrowed;
    
    if (totalTransactions >= 1000) {
        this.tier = 'Gold';
    } else if (totalTransactions >= 500) {
        this.tier = 'Silver';
    } else {
        this.tier = 'Bronze';
    }
};

module.exports = mongoose.model('User', userSchema);