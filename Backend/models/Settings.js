// models/Settings.js
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    description: {
        type: String,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

// Static helper to get a value with a fallback default
settingsSchema.statics.get = async function(key, defaultValue) {
    const doc = await this.findOne({ key });
    return doc ? doc.value : defaultValue;
};

// Static helper to set a value
settingsSchema.statics.set = async function(key, value, adminId) {
    return this.findOneAndUpdate(
        { key },
        { value, updatedBy: adminId },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
};

module.exports = mongoose.model('Settings', settingsSchema);
