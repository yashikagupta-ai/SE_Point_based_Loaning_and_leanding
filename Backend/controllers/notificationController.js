// controllers/notificationController.js
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// @desc    Get user notifications (newest first, max 50)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const unreadCount = notifications.filter(n => !n.isRead).length;

        res.json({
            success: true,
            data: notifications,
            unreadCount
        });
    } catch (error) {
        logger.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get notifications',
            error: error.message
        });
    }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification marked as read', data: notification });
    } catch (error) {
        logger.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification',
            error: error.message
        });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.id, isRead: false },
            { isRead: true }
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        logger.error('Mark all read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notifications',
            error: error.message
        });
    }
};

// @desc    Get unread notification count (used by header badge)
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ user: req.user.id, isRead: false });
        res.json({ success: true, data: { count } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get count' });
    }
};

// @desc    Get notification settings
// @route   GET /api/notifications/settings
// @access  Private
const getNotificationSettings = async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                emailEnabled: true,
                pushEnabled: true,
                loanAlerts: true,
                dueDateReminders: true,
                promotionalEmails: false
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get settings' });
    }
};

// @desc    Update notification settings
// @route   PUT /api/notifications/settings
// @access  Private
const updateNotificationSettings = async (req, res) => {
    try {
        res.json({ success: true, message: 'Settings updated successfully', data: req.body });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    getNotificationSettings,
    updateNotificationSettings
};
