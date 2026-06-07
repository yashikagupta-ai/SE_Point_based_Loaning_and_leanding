// routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getWallet,
    getTransactions,
    getTransactionById,
    transferPoints,
    purchasePoints
} = require('../controllers/walletController');

// All routes are protected
router.use(protect);

// Wallet routes
router.get('/', getWallet);
router.get('/transactions', getTransactions);
router.get('/transactions/:id', getTransactionById);
router.post('/transfer', transferPoints);
router.post('/purchase', purchasePoints);

module.exports = router;