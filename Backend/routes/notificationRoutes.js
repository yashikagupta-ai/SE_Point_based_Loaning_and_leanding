const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    getNotificationSettings,
    updateNotificationSettings
} = require('../controllers/notificationController');

router.use(protect);

router.get('/',                 getNotifications);
router.get('/unread-count',     getUnreadCount);
router.put('/read-all',         markAllAsRead);
router.put('/:id/read',         markAsRead);
router.get('/settings',         getNotificationSettings);
router.put('/settings',         updateNotificationSettings);

module.exports = router;
