// scripts/initDb.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Badge = require('../models/Badge');
const logger = require('../utils/logger');

const initDatabase = async () => {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connected to MongoDB for initialization');

        // Create default admin user
        const adminExists = await User.findOne({ email: 'admin@mahindrauniversity.edu.in' });
        
        if (!adminExists) {
            const admin = await User.create({
                email: 'admin@mahindrauniversity.edu.in',
                password: 'Admin@123',
                name: 'System Administrator',
                role: 'admin',
                isKYCVerified: true,
                creditScore: 900
            });
            
            logger.info('Default admin user created');
        }

        // Create predefined badges
        const predefinedBadges = Badge.getPredefinedBadges();
        
        for (const badgeData of predefinedBadges) {
            const exists = await Badge.findOne({ name: badgeData.name });
            if (!exists) {
                await Badge.create(badgeData);
                logger.info(`Badge created: ${badgeData.name}`);
            }
        }

        logger.info('Database initialization completed successfully');
        
    } catch (error) {
        logger.error('Database initialization failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

initDatabase();