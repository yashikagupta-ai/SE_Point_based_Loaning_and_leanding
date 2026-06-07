// controllers/walletController.js
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// @desc    Get user wallet
// @route   GET /api/wallet
// @access  Private
const getWallet = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ user: req.user.id });

        // Create wallet if it doesn't exist
        if (!wallet) {
            wallet = await Wallet.create({
                user: req.user.id,
                balance: 100, // Signup bonus
                totalEarned: 100
            });
        }

        // Get recent transactions
        const recentTransactions = await Transaction.find({
            $or: [
                { fromUser: req.user.id },
                { toUser: req.user.id }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('fromUser', 'name email')
        .populate('toUser', 'name email');

        res.json({
            success: true,
            data: {
                wallet: {
                    balance: wallet.balance,
                    lockedBalance: wallet.lockedBalance,
                    availableBalance: wallet.availableBalance,
                    totalEarned: wallet.totalEarned,
                    totalSpent: wallet.totalSpent
                },
                recentTransactions
            }
        });
    } catch (error) {
        logger.error('Get wallet error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get wallet',
            error: error.message
        });
    }
};

// @desc    Get transaction history
// @route   GET /api/wallet/transactions
// @access  Private
const getTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, startDate, endDate } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {
            $or: [
                { fromUser: req.user.id },
                { toUser: req.user.id }
            ]
        };

        if (type) {
            query.type = type;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(query)
            .populate('fromUser', 'name email')
            .populate('toUser', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Transaction.countDocuments(query);

        // Calculate summary statistics
        const stats = await Transaction.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        res.json({
            success: true,
            data: transactions,
            stats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get transactions',
            error: error.message
        });
    }
};

// @desc    Get transaction by ID
// @route   GET /api/wallet/transactions/:id
// @access  Private
const getTransactionById = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('fromUser', 'name email')
            .populate('toUser', 'name email')
            .populate('reference');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Check if user is part of transaction
        if (req.user.role !== 'admin' &&
            transaction.fromUser?._id.toString() !== req.user.id &&
            transaction.toUser?._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this transaction'
            });
        }

        res.json({
            success: true,
            data: transaction
        });
    } catch (error) {
        logger.error('Get transaction by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get transaction',
            error: error.message
        });
    }
};

// @desc    Transfer points to another user
// @route   POST /api/wallet/transfer
// @access  Private
const transferPoints = async (req, res) => {
    try {
        const { toUserId, amount, description } = req.body;

        // Validate amount
        if (!amount || Number(amount) < 1) {
            return res.status(400).json({
                success: false,
                message: 'Transfer amount must be at least 1 point'
            });
        }

        const amt = Number(amount);

        // Check if transferring to self
        if (toUserId === req.user.id || toUserId === req.user._id?.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot transfer points to yourself'
            });
        }

        // Get receiver user
        const receiver = await User.findById(toUserId);
        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: 'Recipient user not found. Please check the User ID.'
            });
        }

        // Get sender's wallet
        const senderWallet = await Wallet.findOne({ user: req.user.id });
        if (!senderWallet) {
            return res.status(400).json({ success: false, message: 'Sender wallet not found' });
        }

        const available = senderWallet.balance - senderWallet.lockedBalance;
        if (available < amt) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Available: ${available} pts`
            });
        }

        // Get or create receiver's wallet
        let receiverWallet = await Wallet.findOne({ user: toUserId });
        if (!receiverWallet) {
            receiverWallet = await Wallet.create({
                user: toUserId,
                balance: 0,
                lockedBalance: 0,
                totalEarned: 0,
                totalSpent: 0
            });
        }

        // Deduct from sender
        senderWallet.balance -= amt;
        senderWallet.totalSpent += amt;
        senderWallet.lastTransactionAt = new Date();
        await senderWallet.save();

        // Add to receiver
        receiverWallet.balance += amt;
        receiverWallet.totalEarned += amt;
        receiverWallet.lastTransactionAt = new Date();
        await receiverWallet.save();

        // Create transaction record
        const transaction = await Transaction.create({
            type: 'points_transfer',
            fromUser: req.user.id,
            toUser: toUserId,
            fromWallet: senderWallet._id,
            toWallet: receiverWallet._id,
            amount: amt,
            description: description || `Transfer to ${receiver.name}`,
            status: 'completed',
            metadata: {
                transferType: 'user_initiated'
            }
        });

        logger.info(`Points transferred: ${amt} from ${req.user.id} to ${toUserId}`);

        res.json({
            success: true,
            data: {
                transaction,
                newBalance: senderWallet.balance
            },
            message: `Successfully transferred ${amt} points to ${receiver.name}`
        });

    } catch (error) {
        logger.error('Transfer points error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to transfer points',
            error: error.message
        });
    }
};

// @desc    Purchase points with simulated payment
// @route   POST /api/wallet/purchase
// @access  Private
const purchasePoints = async (req, res) => {
    try {
        const { points, pricePaid } = req.body;

        if (!points || Number(points) < 1) {
            return res.status(400).json({ success: false, message: 'Invalid points amount' });
        }

        const pts = Number(points);

        // Atomically create-or-update wallet — no separate session needed
        const wallet = await Wallet.findOneAndUpdate(
            { user: req.user.id },
            {
                $inc:  { balance: pts, totalEarned: pts },
                $set:  { lastTransactionAt: new Date() },
                $setOnInsert: { lockedBalance: 0, totalSpent: 0 }
            },
            { upsert: true, new: true }
        );

        // Record transaction separately (no session — atomic wallet update already committed)
        await Transaction.create({
            type:        'points_purchased',
            toUser:      req.user.id,
            toWallet:    wallet._id,
            amount:      pts,
            description: `Purchased ${pts} points for ₹${pricePaid} (simulated)`,
            status:      'completed',
            metadata:    new Map([
                ['pricePaid',      String(pricePaid)],
                ['paymentMethod',  'simulated_card']
            ])
        });

        logger.info(`Points purchased: ${pts} by ${req.user.id}, new balance: ${wallet.balance}`);

        res.json({
            success: true,
            data:    { newBalance: wallet.balance, pointsAdded: pts },
            message: `Successfully added ${pts} points to your wallet`
        });
    } catch (error) {
        logger.error('Purchase points error:', error);
        res.status(500).json({ success: false, message: 'Failed to purchase points', error: error.message });
    }
};

module.exports = {
    getWallet,
    getTransactions,
    getTransactionById,
    transferPoints,
    purchasePoints
};
