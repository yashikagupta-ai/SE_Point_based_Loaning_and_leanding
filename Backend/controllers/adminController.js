const User = require('../models/User');
const Loan = require('../models/Loan');
const LoanRequest = require('../models/LoanRequest');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const LoginAttempt = require('../models/LoginAttempt');
const ItemListing = require('../models/ItemListing');
const Settings   = require('../models/Settings');
const CreditScoreService = require('../services/creditScoreService');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, verified } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }
        
        if (verified === 'true') {
            query.isKYCVerified = true;
        } else if (verified === 'false') {
            query.isKYCVerified = false;
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get wallet balances for users
        const userIds = users.map(u => u._id);
        const wallets = await Wallet.find({ user: { $in: userIds } }).lean();
        
        const walletMap = {};
        wallets.forEach(w => {
            walletMap[w.user.toString()] = w;
        });

        // Enhance users with wallet data
        const enhancedUsers = users.map(user => ({
            ...user,
            walletBalance: walletMap[user._id.toString()]?.balance || 0,
            lockedBalance: walletMap[user._id.toString()]?.lockedBalance || 0
        }));

        const total = await User.countDocuments(query);

        // Get statistics
        const stats = {
            totalUsers: await User.countDocuments(),
            verifiedUsers: await User.countDocuments({ isKYCVerified: true }),
            activeUsers: await User.countDocuments({ isActive: true }),
            adminCount: await User.countDocuments({ role: 'admin' })
        };

        res.json({
            success: true,
            data: enhancedUsers,
            stats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get users',
            error: error.message
        });
    }
};

// @desc    Get user details by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserDetails = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get wallet
        const wallet = await Wallet.findOne({ user: user._id }).lean();

        // Get loan statistics
        const loanStats = await Loan.aggregate([
            { $match: { borrower: mongoose.Types.ObjectId(req.params.id) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$principal' }
                }
            }
        ]);

        // Get recent transactions
        const recentTransactions = await Transaction.find({
            $or: [
                { fromUser: user._id },
                { toUser: user._id }
            ]
        })
        .populate('fromUser', 'name email')
        .populate('toUser', 'name email')
        .sort({ createdAt: -1 })
        .limit(10);

        // Get login attempts
        const loginAttempts = await LoginAttempt.find({ email: user.email })
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            success: true,
            data: {
                user,
                wallet: wallet || { balance: 0, lockedBalance: 0 },
                loanStats,
                recentTransactions,
                loginAttempts
            }
        });

    } catch (error) {
        logger.error('Get user details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user details',
            error: error.message
        });
    }
};

// @desc    Freeze user account
// @route   POST /api/admin/users/:id/freeze
// @access  Private/Admin
const freezeUser = async (req, res) => {
    try {
        const { reason } = req.body;

        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Cannot freeze admin accounts'
            });
        }

        user.isActive = false;
        await user.save();

        logger.warn(`User account frozen: ${user.email} by admin ${req.user.id}. Reason: ${reason}`);

        res.json({
            success: true,
            message: `User ${user.name} has been frozen successfully`,
            data: {
                userId: user._id,
                email: user.email,
                status: 'frozen'
            }
        });

    } catch (error) {
        logger.error('Freeze user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to freeze user',
            error: error.message
        });
    }
};

// @desc    Activate user account
// @route   POST /api/admin/users/:id/activate
// @access  Private/Admin
const activateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.isActive = true;
        await user.save();

        logger.info(`User account activated: ${user.email} by admin ${req.user.id}`);

        res.json({
            success: true,
            message: `User ${user.name} has been activated successfully`,
            data: {
                userId: user._id,
                email: user.email,
                status: 'active'
            }
        });

    } catch (error) {
        logger.error('Activate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to activate user',
            error: error.message
        });
    }
};

// @desc    Get all transactions
// @route   GET /api/admin/transactions
// @access  Private/Admin
const getAllTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, startDate, endDate } = req.query;
        const skip = (page - 1) * limit;

        const query = {};
        
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

        // Get summary stats
        const summary = await Transaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    avgAmount: { $avg: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: transactions,
            summary: summary[0] || { totalAmount: 0, avgAmount: 0, count: 0 },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error('Get all transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get transactions',
            error: error.message
        });
    }
};

// @desc    Get system statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getSystemStats = async (req, res) => {
    try {
        // User statistics
        const userStats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    verified: { $sum: { $cond: ['$isKYCVerified', 1, 0] } },
                    active: { $sum: { $cond: ['$isActive', 1, 0] } },
                    avgCreditScore: { $avg: '$creditScore' }
                }
            }
        ]);

        // Loan statistics
        const loanStats = await Loan.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$principal' },
                    totalInterest: { $sum: '$interestAccrued' }
                }
            }
        ]);

        // Transaction statistics
        const transactionStats = await Transaction.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        // Points in circulation
        const walletStats = await Wallet.aggregate([
            {
                $group: {
                    _id: null,
                    totalPoints: { $sum: '$balance' },
                    lockedPoints: { $sum: '$lockedBalance' },
                    avgBalance: { $avg: '$balance' }
                }
            }
        ]);

        // Recent activity
        const recentActivity = await Transaction.find()
            .populate('fromUser', 'name email')
            .populate('toUser', 'name email')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            success: true,
            data: {
                users: userStats[0] || { total: 0, verified: 0, active: 0, avgCreditScore: 500 },
                loans: loanStats,
                transactions: transactionStats,
                points: walletStats[0] || { totalPoints: 0, lockedPoints: 0, avgBalance: 0 },
                recentActivity
            }
        });

    } catch (error) {
        logger.error('Get system stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get system statistics',
            error: error.message
        });
    }
};

// @desc    Get dashboard statistics (for admin dashboard)
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    try {
        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get counts
        const [
            totalUsers,
            newUsersToday,
            pendingLoans,
            activeLoans,
            totalTransactions,
            totalPoints
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
            LoanRequest.countDocuments({ status: 'pending' }),
            Loan.countDocuments({ status: 'active' }),
            Transaction.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
            Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }])
        ]);

        // Get recent loan requests
        const recentRequests = await LoanRequest.find({ status: 'pending' })
            .populate('borrower', 'name email creditScore')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get high risk users
        const highRiskUsers = await User.find({ 
            creditScore: { $lt: 400 },
            isActive: true 
        })
        .select('name email creditScore')
        .limit(5);

        res.json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    newUsersToday,
                    pendingLoans,
                    activeLoans,
                    transactionsToday: totalTransactions,
                    totalPointsInCirculation: totalPoints[0]?.total || 0
                },
                recentRequests,
                highRiskUsers,
                timestamp: new Date()
            }
        });

    } catch (error) {
        logger.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get dashboard statistics',
            error: error.message
        });
    }
};

// @desc    Get risk heatmap data
// @route   GET /api/admin/risk-heatmap
// @access  Private/Admin
const getRiskHeatmap = async (req, res) => {
    try {
        const riskData = await User.aggregate([
            {
                $group: {
                    _id: {
                        scoreRange: {
                            $switch: {
                                branches: [
                                    { case: { $lte: ['$creditScore', 400] }, then: 'High Risk' },
                                    { case: { $lte: ['$creditScore', 600] }, then: 'Medium Risk' },
                                    { case: { $lte: ['$creditScore', 750] }, then: 'Low Risk' }
                                ],
                                default: 'Excellent'
                            }
                        },
                        kycStatus: '$isKYCVerified'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get default rates
        const defaultRates = await Loan.aggregate([
            {
                $group: {
                    _id: {
                        $cond: ['$isLate', 'Late', 'On Time']
                    },
                    count: { $sum: 1 },
                    amount: { $sum: '$principal' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                riskDistribution: riskData,
                defaultRates,
                timestamp: new Date()
            }
        });

    } catch (error) {
        logger.error('Get risk heatmap error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get risk heatmap',
            error: error.message
        });
    }
};

// @desc    Get fraud alerts
// @route   GET /api/admin/fraud-alerts
// @access  Private/Admin
const getFraudAlerts = async (req, res) => {
    try {
        // Check for multiple login attempts
        const suspiciousLogins = await LoginAttempt.find({
            attempts: { $gte: 5 },
            lockedUntil: { $ne: null }
        })
        .sort({ createdAt: -1 })
        .limit(20);

        // Check for users with multiple loan requests
        const suspiciousRequests = await LoanRequest.aggregate([
            {
                $group: {
                    _id: '$borrower',
                    count: { $sum: 1 },
                    requests: { $push: '$$ROOT' }
                }
            },
            { $match: { count: { $gte: 5 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Populate user details for suspicious requests
        const populatedRequests = await User.populate(suspiciousRequests, {
            path: '_id',
            select: 'name email creditScore'
        });

        res.json({
            success: true,
            data: {
                suspiciousLogins,
                suspiciousRequests: populatedRequests,
                timestamp: new Date()
            }
        });

    } catch (error) {
        logger.error('Get fraud alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get fraud alerts',
            error: error.message
        });
    }
};

// @desc    Resolve dispute
// @route   POST /api/admin/resolve-dispute
// @access  Private/Admin
const resolveDispute = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { loanId, resolution, action } = req.body;

        const loan = await Loan.findById(loanId)
            .populate('borrower')
            .populate('lender');

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        // Handle different resolution actions
        switch (action) {
            case 'waive_penalty':
                loan.latePenaltyAmount = 0;
                loan.latePenaltyApplied = false;
                break;
                
            case 'adjust_interest':
                // Adjust interest logic
                break;
                
            case 'mark_as_repaid':
                loan.status = 'repaid';
                loan.completedDate = new Date();
                break;
                
            default:
                // Log the dispute
                break;
        }

        await loan.save({ session });

        // Log the dispute resolution
        logger.info(`Dispute resolved for loan ${loanId} by admin ${req.user.id}. Action: ${action}`);

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Dispute resolved successfully',
            data: loan
        });

    } catch (error) {
        await session.abortTransaction();
        logger.error('Resolve dispute error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resolve dispute',
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Adjust interest rates
// @route   POST /api/admin/adjust-interest
// @access  Private/Admin
const adjustInterestRates = async (req, res) => {
    try {
        const { baseRate, maxRate, minRate } = req.body;

        // This would update system-wide interest rate settings
        // For now, just log the action
        logger.info(`Interest rates adjusted by admin ${req.user.id}:`, {
            baseRate,
            maxRate,
            minRate
        });

        res.json({
            success: true,
            message: 'Interest rates updated successfully',
            data: { baseRate, maxRate, minRate }
        });

    } catch (error) {
        logger.error('Adjust interest rates error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to adjust interest rates',
            error: error.message
        });
    }
};

// @desc    Export reports
// @route   GET /api/admin/export/:type
// @access  Private/Admin
const exportReports = async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate } = req.query;

        let data = [];
        let filename = '';

        switch (type) {
            case 'users':
                data = await User.find({
                    createdAt: {
                        $gte: new Date(startDate || '2020-01-01'),
                        $lte: new Date(endDate || new Date())
                    }
                }).select('-password').lean();
                filename = 'users_report.csv';
                break;

            case 'transactions':
                data = await Transaction.find({
                    createdAt: {
                        $gte: new Date(startDate || '2020-01-01'),
                        $lte: new Date(endDate || new Date())
                    }
                })
                .populate('fromUser', 'email')
                .populate('toUser', 'email')
                .lean();
                filename = 'transactions_report.csv';
                break;

            case 'loans':
                data = await Loan.find({
                    createdAt: {
                        $gte: new Date(startDate || '2020-01-01'),
                        $lte: new Date(endDate || new Date())
                    }
                })
                .populate('borrower', 'email')
                .populate('lender', 'email')
                .lean();
                filename = 'loans_report.csv';
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type'
                });
        }

        // Convert to CSV (simplified)
        const csv = convertToCSV(data);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(csv);

    } catch (error) {
        logger.error('Export reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export report',
            error: error.message
        });
    }
};

// Helper function to convert JSON to CSV
const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    csvRows.push(headers.join(','));
    
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header] || '';
            return `"${value.toString().replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
};

// @desc    Delete a single inappropriate item listing
// @route   DELETE /api/admin/items/:id
// @access  Private/Admin
const deleteItem = async (req, res) => {
    try {
        const listing = await ItemListing.findById(req.params.id).populate('lender', 'name email');
        if (!listing) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // If item is currently borrowed, refund the borrower
        if (listing.status === 'borrowed' && listing.currentBorrower) {
            const activeReq = listing.borrowRequests.find(
                r => r.status === 'approved' && r.borrower.toString() === listing.currentBorrower.toString()
            );
            if (activeReq) {
                const refundPoints = activeReq.agreedPoints ?? activeReq.totalPoints;
                const borrowerWallet = await Wallet.findOne({ user: listing.currentBorrower });
                if (borrowerWallet) {
                    borrowerWallet.balance += refundPoints;
                    borrowerWallet.lockedBalance = Math.max(0, borrowerWallet.lockedBalance - refundPoints);
                    await borrowerWallet.save();
                }
            }
        }

        await ItemListing.deleteOne({ _id: listing._id });
        logger.warn(`Admin ${req.user.id} deleted item ${listing._id} (${listing.itemName}) owned by ${listing.lender?.email}`);

        res.json({
            success: true,
            message: `Item "${listing.itemName}" has been permanently deleted.`,
            data: { itemId: listing._id, itemName: listing.itemName }
        });
    } catch (error) {
        logger.error('Delete item error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete item', error: error.message });
    }
};

// @desc    Get all item listings (admin view — includes unlisted)
// @route   GET /api/admin/items
// @access  Private/Admin
const getAllItems = async (req, res) => {
    try {
        const { page = 1, limit = 20, category, status, search } = req.query;
        const skip = (page - 1) * limit;

        const query = {};
        if (category) query.category = category;
        if (status)   query.status   = status;
        if (search)   query.itemName = { $regex: search, $options: 'i' };

        const [items, total] = await Promise.all([
            ItemListing.find(query)
                .populate('lender', 'name email')
                .populate('currentBorrower', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ItemListing.countDocuments(query)
        ]);

        // Category breakdown
        const categoryStats = await ItemListing.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 }, available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } } } }
        ]);

        res.json({
            success: true,
            data: items,
            categoryStats,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        logger.error('Get all items error:', error);
        res.status(500).json({ success: false, message: 'Failed to get items', error: error.message });
    }
};

// @desc    Get allowed categories
// @route   GET /api/admin/categories
// @access  Private/Admin
const getCategories = async (req, res) => {
    try {
        const ALLOWED_CATEGORIES = ['textbooks', 'lab equipment', 'sports gear', 'electronics', 'stationery', 'furniture', 'clothing', 'other'];
        const stats = await ItemListing.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);
        const statsMap = {};
        stats.forEach(s => { statsMap[s._id] = s.count; });

        res.json({
            success: true,
            data: ALLOWED_CATEGORIES.map(cat => ({ name: cat, count: statsMap[cat] || 0 }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get categories', error: error.message });
    }
};

// Allowed settings with validation rules
const SETTINGS_CONFIG = {
    signup_bonus_points: {
        description: 'Points awarded to new users on signup',
        type: 'number', min: 0, max: 10000, default: 100
    },
    max_loan_duration_days: {
        description: 'Maximum number of days an item can be borrowed',
        type: 'number', min: 1, max: 365, default: 30
    },
    max_points_per_day: {
        description: 'Maximum points per day a lender can charge for an item',
        type: 'number', min: 1, max: 10000, default: 1000
    },
    late_penalty_per_return: {
        description: 'Trust score points deducted per late return',
        type: 'number', min: 0, max: 100, default: 10
    },
    max_active_borrows_per_user: {
        description: 'Maximum number of items a user can borrow at one time',
        type: 'number', min: 1, max: 50, default: 5
    },
};

// @desc    Get all platform settings
// @route   GET /api/admin/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
    try {
        const saved = await Settings.find({}).lean();
        const savedMap = {};
        saved.forEach(s => { savedMap[s.key] = s.value; });

        const data = Object.entries(SETTINGS_CONFIG).map(([key, config]) => ({
            key,
            value: savedMap[key] !== undefined ? savedMap[key] : config.default,
            description: config.description,
            min: config.min,
            max: config.max,
            default: config.default,
        }));

        res.json({ success: true, data });
    } catch (error) {
        logger.error('Get settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to get settings', error: error.message });
    }
};

// @desc    Adjust a platform setting
// @route   POST /api/admin/settings
// @access  Private/Admin
const adjustSettings = async (req, res) => {
    try {
        const { setting, value } = req.body;

        const config = SETTINGS_CONFIG[setting];
        if (!config) {
            return res.status(400).json({
                success: false,
                message: `Unknown setting "${setting}". Allowed: ${Object.keys(SETTINGS_CONFIG).join(', ')}`
            });
        }

        const numVal = Number(value);
        if (isNaN(numVal)) {
            return res.status(400).json({ success: false, message: 'Value must be a number' });
        }
        if (numVal < config.min || numVal > config.max) {
            return res.status(400).json({
                success: false,
                message: `Value for "${setting}" must be between ${config.min} and ${config.max}`
            });
        }

        await Settings.set(setting, numVal, req.user.id);
        logger.info(`Admin ${req.user.id} updated setting "${setting}" → ${numVal}`);

        res.json({
            success: true,
            message: `"${setting}" updated to ${numVal}`,
            data: { setting, value: numVal, description: config.description }
        });
    } catch (error) {
        logger.error('Adjust settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update setting', error: error.message });
    }
};


// @desc    Generate a structured report
// @route   GET /api/admin/reports/:type
// @access  Private/Admin
const generateReport = async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate, format = 'json' } = req.query;

        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate)   dateFilter.$lte = new Date(endDate);
        const hasDateFilter = Object.keys(dateFilter).length > 0;

        let reportData = {};

        switch (type) {
            case 'users': {
                const query = hasDateFilter ? { createdAt: dateFilter } : {};
                const users = await User.find(query).select('-password').lean();
                const wallets = await Wallet.find({ user: { $in: users.map(u => u._id) } }).lean();
                const walletMap = {};
                wallets.forEach(w => { walletMap[w.user.toString()] = w.balance; });
                reportData = {
                    title: 'User Report',
                    generated: new Date(),
                    total: users.length,
                    summary: {
                        active: users.filter(u => u.isActive).length,
                        frozen: users.filter(u => !u.isActive).length,
                        kycVerified: users.filter(u => u.isKYCVerified).length,
                        admins: users.filter(u => u.role === 'admin').length,
                    },
                    records: users.map(u => ({
                        id: u._id, name: u.name, email: u.email, role: u.role,
                        creditScore: u.creditScore, isActive: u.isActive, isKYCVerified: u.isKYCVerified,
                        walletBalance: walletMap[u._id.toString()] || 0,
                        tier: u.tier, createdAt: u.createdAt
                    }))
                };
                break;
            }
            case 'transactions': {
                const query = hasDateFilter ? { createdAt: dateFilter } : {};
                const txns = await Transaction.find(query)
                    .populate('fromUser', 'name email').populate('toUser', 'name email').lean();
                reportData = {
                    title: 'Transaction Report',
                    generated: new Date(),
                    total: txns.length,
                    summary: {
                        totalVolume: txns.reduce((s, t) => s + (t.amount || 0), 0),
                        byType: txns.reduce((acc, t) => { acc[t.type] = (acc[t.type] || 0) + 1; return acc; }, {})
                    },
                    records: txns
                };
                break;
            }
            case 'items': {
                const query = hasDateFilter ? { createdAt: dateFilter } : {};
                const items = await ItemListing.find(query)
                    .populate('lender', 'name email').populate('currentBorrower', 'name email').lean();
                reportData = {
                    title: 'Items Report',
                    generated: new Date(),
                    total: items.length,
                    summary: {
                        available: items.filter(i => i.status === 'available').length,
                        borrowed:  items.filter(i => i.status === 'borrowed').length,
                        unlisted:  items.filter(i => i.status === 'unlisted').length,
                    },
                    records: items
                };
                break;
            }
            case 'overview': {
                const [uStats, tStats, iStats, wStats] = await Promise.all([
                    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } }]),
                    Transaction.aggregate([{ $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } }]),
                    ItemListing.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
                    Wallet.aggregate([{ $group: { _id: null, totalBalance: { $sum: '$balance' }, avgBalance: { $avg: '$balance' } } }]),
                ]);
                reportData = {
                    title: 'Platform Overview Report',
                    generated: new Date(),
                    users: uStats,
                    transactions: tStats,
                    items: iStats,
                    wallet: wStats[0] || {}
                };
                break;
            }
            default:
                return res.status(400).json({ success: false, message: 'Invalid report type. Use: users, transactions, items, overview' });
        }

        if (format === 'csv') {
            const csv = convertToCSV(reportData.records || [reportData.summary]);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${type}_report_${Date.now()}.csv`);
            return res.send(csv);
        }

        res.json({ success: true, data: reportData });
    } catch (error) {
        logger.error('Generate report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate report', error: error.message });
    }
};


const deleteAllItems = async (req, res) => {
    try {
        const result = await ItemListing.deleteMany({});
        logger.info(`Admin deleted all items: ${result.deletedCount} items removed`);
        res.json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} item listing(s).`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        logger.error('Delete all items error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete items', error: error.message });
    }
};

module.exports = {
    getAllUsers,
    getUserDetails,
    freezeUser,
    activateUser,
    getAllTransactions,
    getSystemStats,
    getDashboardStats,
    getRiskHeatmap,
    getFraudAlerts,
    resolveDispute,
    adjustInterestRates,
    exportReports,
    deleteAllItems,
    deleteItem,
    getAllItems,
    getCategories,
    getSettings,
    adjustSettings,
    generateReport
};