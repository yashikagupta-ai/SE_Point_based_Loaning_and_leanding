// routes/adminRoutes.js
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { admin }   = require('../middleware/adminMiddleware');
const {
    getAllUsers,
    getUserDetails,
    freezeUser,
    activateUser,
    getAllTransactions,
    getSystemStats,
    getRiskHeatmap,
    getFraudAlerts,
    resolveDispute,
    adjustInterestRates,
    exportReports,
    getDashboardStats,
    deleteAllItems,
    deleteItem,
    getAllItems,
    getCategories,
    getSettings,
    adjustSettings,
    generateReport,
} = require('../controllers/adminController');

// All routes require authentication + admin role
router.use(protect, admin);

// Dashboard
router.get('/dashboard', getDashboardStats);
router.get('/stats',     getSystemStats);

// User management
router.get('/users',               getAllUsers);
router.get('/users/:id',           getUserDetails);
router.post('/users/:id/freeze',   freezeUser);
router.post('/users/:id/activate', activateUser);

// Transaction monitoring
router.get('/transactions', getAllTransactions);

// Item management (bulk delete BEFORE :id route)
router.get('/items',        getAllItems);
router.delete('/items/all', deleteAllItems);
router.delete('/items/:id', deleteItem);

// Categories
router.get('/categories', getCategories);

// System settings
router.get('/settings',         getSettings);
router.post('/settings',        adjustSettings);
router.post('/adjust-interest', adjustInterestRates);

// Risk & fraud
router.get('/risk-heatmap', getRiskHeatmap);
router.get('/fraud-alerts', getFraudAlerts);

// Disputes
router.post('/resolve-dispute', resolveDispute);

// Reports
router.get('/reports/:type', generateReport);
router.get('/export/:type',  exportReports);

module.exports = router;
