/**
 * Run with: node scripts/deleteWaterBottles.js
 * Deletes all water bottle listings posted by Ishani Singh
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ItemListing = require('../models/ItemListing');
const User = require('../models/User');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/points_lending');
    console.log('Connected to MongoDB');

    const ishani = await User.findOne({ name: /ishani/i });
    if (!ishani) {
        console.log('User "Ishani Singh" not found');
        process.exit(0);
    }

    const result = await ItemListing.deleteMany({
        lender: ishani._id,
        itemName: /water bottle/i
    });
    console.log(`✅ Deleted ${result.deletedCount} water bottle listing(s) for ${ishani.name}`);
    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
