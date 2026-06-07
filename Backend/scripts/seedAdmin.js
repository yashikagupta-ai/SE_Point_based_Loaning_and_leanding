/**
 * seedAdmin.js
 * Creates default admin accounts for the platform.
 * Run: node scripts/seedAdmin.js
 *
 * Admin emails follow the pattern: name@mahindrauniveristy.edu.in
 * (note the domain used in the project spec).
 * Admins bypass KYC entirely — no student ID or document upload needed.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');
const Wallet   = require('../models/Wallet');

const ADMINS = [
    { name: 'Nidhi Goyal',   email: 'nidhi.goyal@mahindrauniveristy.edu.in',   password: 'Admin@1234' },
    { name: 'Platform Admin', email: 'admin@mahindrauniversity.edu.in',          password: 'Admin@1234' },
];

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const a of ADMINS) {
        const exists = await User.findOne({ email: a.email });
        if (exists) {
            // Ensure the existing account is an admin and KYC-verified
            await User.updateOne({ email: a.email }, {
                role: 'admin',
                isKYCVerified: true,
                isActive: true,
            });
            console.log(`✓ Updated existing account → ${a.email}`);
        } else {
            const user = await User.create({
                name: a.name,
                email: a.email,
                password: a.password,   // pre-save hook will hash it
                role: 'admin',
                isKYCVerified: true,    // admins skip KYC
                isActive: true,
            });
            // Give admin a wallet (won't be used for transactions, but avoids null refs)
            await Wallet.create({ user: user._id, balance: 0, totalEarned: 0 });
            console.log(`✓ Created admin account → ${a.email}  (password: ${a.password})`);
        }
    }

    await mongoose.disconnect();
    console.log('Done.');
}

seed().catch(err => { console.error(err); process.exit(1); });
