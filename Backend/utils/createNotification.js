// utils/createNotification.js
const Notification = require('../models/Notification');
const logger = require('./logger');

async function createNotification(opts) {
    try {
        await Notification.create(opts);
        // Real-time push to the recipient
        if (global.io && opts.user) {
            global.io.to(opts.user.toString()).emit('notification_update', {
                type: opts.type,
                title: opts.title
            });
        }
    } catch (err) {
        logger.error('createNotification failed:', err.message);
    }
}

module.exports = createNotification;
