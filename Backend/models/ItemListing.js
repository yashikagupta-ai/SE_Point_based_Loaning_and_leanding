// models/ItemListing.js
// A lender posts an item they own and are willing to lend.
// Borrowers request to borrow it and pay the listed points upfront.
const mongoose = require('mongoose');

const borrowRequestSchema = new mongoose.Schema({
    borrower: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        default: '',
        maxlength: 300
    },
    duration: {
        type: Number,
        default: 1
    },
    totalPoints: {
        type: Number,
        default: 0
    },
    agreedPoints: {
        type: Number,
        default: null   // set when lender approves at a negotiated (lower) amount
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'returned', 'cancelled'],
        default: 'pending'
    },
    requestedAt:  { type: Date, default: Date.now },
    approvedAt:   Date,
    returnedAt:   Date,
    rejectedAt:   Date,
    rejectionReason: String
});

const itemListingSchema = new mongoose.Schema({
    lender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemName: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: 500
    },
    category: {
        type: String,
        enum: ['textbooks', 'lab equipment', 'sports gear', 'electronics', 'stationery', 'furniture', 'clothing', 'other'],
        default: 'other'
    },
    pointsPerDay: {
        type: Number,
        required: [true, 'Points per day is required'],
        min: [1, 'Minimum 1 point per day'],
        max: [1000, 'Maximum 1000 points per day']
    },
    maxDuration: {
        type: Number,       // max borrow days
        required: true,
        min: 1,
        max: 365,
        default: 30
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['available', 'borrowed', 'unlisted'],
        default: 'available'
    },
    currentBorrower: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    borrowRequests: [borrowRequestSchema],
    images: [String],           // future: item photos
    condition: {
        type: String,
        enum: ['new', 'like new', 'good', 'fair'],
        default: 'good'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ItemListing', itemListingSchema);
