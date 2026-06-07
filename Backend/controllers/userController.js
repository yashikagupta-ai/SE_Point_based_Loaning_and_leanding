// controllers/userController.js
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Loan = require('../models/Loan');
const UserBadge = require('../models/UserBadge');
const Badge = require('../models/Badge');
const Transaction = require('../models/Transaction');
const CreditScoreService = require('../services/creditScoreService');
const logger = require('../utils/logger');
const createNotification = require('../utils/createNotification');
const fs = require('fs');
const path = require('path');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password')
            .lean();

        const wallet = await Wallet.findOne({ user: user._id }).lean();

        // Get active loans count
        const activeLoans = await Loan.countDocuments({
            borrower: user._id,
            status: 'active'
        });

        // Get badges count
        const badges = await UserBadge.countDocuments({
            user: user._id
        });

        res.json({
            success: true,
            data: {
                ...user,
                wallet,
                stats: {
                    activeLoans,
                    badges,
                    totalLent: user.totalLent,
                    totalBorrowed: user.totalBorrowed
                }
            }
        });
    } catch (error) {
        logger.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile',
            error: error.message
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const { name, lendingCapacity } = req.body;
        const updateData = {};

        if (name) updateData.name = name;
        if (lendingCapacity !== undefined) {
            // Validate lending capacity
            if (lendingCapacity < 0 || lendingCapacity > 100000) {
                return res.status(400).json({
                    success: false,
                    message: 'Lending capacity must be between 0 and 100000'
                });
            }
            updateData.lendingCapacity = lendingCapacity;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            data: user,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        logger.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};

// @desc    Upload & auto-verify KYC
// @route   POST /api/users/kyc
// @access  Private
const uploadKYC = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload your student ID card' });
        }

        const user = await User.findById(req.user.id);

        // ── Primary verification: email domain ───────────────────────────────
        // Every registered user already has a @mahindrauniversity.edu.in email
        // (enforced at registration by the User model validator). Uploading a
        // document confirms intent; the email proves institutional membership.
        const isMUEmail = user.email && user.email.endsWith('@mahindrauniversity.edu.in');

        // ── OCR: extract text from uploaded image ────────────────────────────
        let extractedStudentId = null;
        let extractedName = null;
        let ocrText = '';

        // Pre-process image with sharp for better OCR accuracy.
        let ocrInputPath = req.file.path;
        const processedPath = req.file.path + '_processed.png';
        try {
            const sharp = require('sharp');
            await sharp(req.file.path)
                .greyscale()
                .normalise()
                .sharpen({ sigma: 1.5 })
                .png()
                .toFile(processedPath);
            ocrInputPath = processedPath;
        } catch (sharpErr) {
            logger.warn('sharp pre-processing failed, using raw file:', sharpErr.message);
        }

        try {
            const { execSync } = require('child_process');
            try {
                const outBase = req.file.path + '_ocr';
                execSync(`tesseract "${ocrInputPath}" "${outBase}" quiet 2>/dev/null`, { timeout: 15000 });
                ocrText = fs.existsSync(outBase + '.txt') ? fs.readFileSync(outBase + '.txt', 'utf8') : '';
                try { fs.unlinkSync(outBase + '.txt'); } catch (_) {}
            } catch (_) {
                try {
                    const Tesseract = require('tesseract.js');
                    const { data: { text } } = await Tesseract.recognize(ocrInputPath, 'eng', { logger: () => {} });
                    ocrText = text || '';
                } catch (tessErr) {
                    logger.warn('OCR unavailable:', tessErr.message);
                }
            }
        } catch (ocrErr) {
            logger.warn('OCR step failed:', ocrErr.message);
        } finally {
            try {
                if (ocrInputPath !== req.file.path && fs.existsSync(processedPath)) {
                    fs.unlinkSync(processedPath);
                }
            } catch (_) {}
        }

        // ── Validate the uploaded card is a Mahindra University ID ──────────
        // The OCR text MUST contain "Mahindra" or "MAHINDRA" to be accepted.
        // This prevents students from uploading unrelated images or IDs from
        // other institutions to bypass verification.
        const ocrFlat = ocrText.toUpperCase().replace(/\s+/g, ' ').trim();
        const hasMahindraKeyword = ocrFlat.includes('MAHINDRA');

        // If OCR produced readable text but it lacks Mahindra University branding,
        // reject the upload immediately and delete the file.
        if (ocrFlat.length > 30 && !hasMahindraKeyword) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
            return res.status(400).json({
                success: false,
                message: '❌ The uploaded image does not appear to be a Mahindra University student ID card. Please upload your official Mahindra University ID.'
            });
        }

        // ── Extract Student ID and Name from OCR text ────────────────────────
        if (ocrFlat.length > 20) {
            const idPatterns = [
                /\b([A-Z]{1,3}\d{2}[A-Z]{2,5}\d{3,6})\b/,
                /\b(\d{2}[A-Z]{2,5}\d{3,6})\b/,
                /(?:ID|ROLL|REG|STUDENT\s*(?:ID|NO))[\s.:]*([A-Z0-9]{6,15})/,
                /\b([A-Z]{2}\d{7,10})\b/
            ];
            for (const pat of idPatterns) {
                const m = ocrFlat.match(pat);
                if (m) { extractedStudentId = m[1]; break; }
            }

            const namePatterns = [
                /NAME\s*[:\-]\s*((?:[A-Z]+\s*){1,4})(?=\s*(?:ID|BLOOD|ROLL|REG|SCHOOL|DEPT|DOB))/,
                /STUDENT NAME\s*[:\-]\s*((?:[A-Z]+\s*){1,4})(?=\s*(?:ID|BLOOD|ROLL|REG|SCHOOL|DEPT|DOB))/,
                /NAME\s*[:\-]\s*([A-Z]+(?:\s+[A-Z]+){0,2})/,
                /(?:MR|MS|DR)[.\s]+([A-Z]+(?:\s+[A-Z]+){0,3})/
            ];
            for (const pat of namePatterns) {
                const m = ocrFlat.match(pat);
                if (m) { extractedName = m[1].trim(); break; }
            }
        }

        // ── Duplicate student ID check ───────────────────────────────────────
        if (extractedStudentId) {
            const duplicate = await User.findOne({
                studentId: extractedStudentId,
                _id: { $ne: user._id }
            });
            if (duplicate) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                return res.status(400).json({
                    success: false,
                    message: 'This student ID is already linked to another account. Each student can only have one account.'
                });
            }
        }

        // ── Delete previous KYC document if one existed ──────────────────────
        if (user.kycDocument) {
            try {
                const oldPath = path.join(__dirname, '..', user.kycDocument);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            } catch (_) {}
        }

        // ── Final verification decision ──────────────────────────────────────
        // Verified only if: (1) MU email domain AND (2) uploaded card explicitly
        // contains the Mahindra University keyword in readable OCR text.
        // If OCR failed or returned too little text, we cannot confirm the card
        // is genuine — reject and ask for a clearer photo.
        const ocrWasReadable = ocrFlat.length > 30;

        if (!ocrWasReadable) {
            // OCR couldn't read the document — reject with helpful guidance
            try { fs.unlinkSync(req.file.path); } catch (_) {}
            return res.status(400).json({
                success: false,
                message: '📷 Could not read text from the uploaded image. Please upload a clear, well-lit photo of the front of your Mahindra University ID card and try again.'
            });
        }

        const autoVerified = isMUEmail && hasMahindraKeyword;

        user.kycDocument   = req.file.path;
        user.isKYCVerified = autoVerified;
        if (extractedStudentId) user.studentId = extractedStudentId;
        if (extractedName)      user.kycExtractedName = extractedName;
        if (autoVerified)       user.kycUniversity = 'Mahindra University';
        await user.save();

        const idInfo = extractedStudentId ? ` Student ID ${extractedStudentId} extracted.` : '';
        const message = autoVerified
            ? `✅ eKYC verified automatically!${idInfo}`
            : '📄 Document uploaded. Please contact admin for manual verification.';

        if (autoVerified) {
            await createNotification({
                user:    user._id,
                type:    'system',
                title:   '🎉 KYC Verified!',
                message: `Your Mahindra University student ID has been verified. You can now post items and borrow from the marketplace.`
            });
        }

        res.json({
            success: true,
            data: { isKYCVerified: autoVerified, studentId: extractedStudentId, extractedName, message }
        });
    } catch (error) {
        logger.error('KYC upload error:', error);
        res.status(500).json({ success: false, message: 'Failed to process KYC document: ' + error.message });
    }
};

// @desc    Get credit score details
// @route   GET /api/users/credit-score
// @access  Private
const getCreditScore = async (req, res) => {
    try {
        const { score, factors, tier } = await CreditScoreService.calculateAndSaveScore(req.user.id);
        const user = await User.findById(req.user.id);

        res.json({
            success: true,
            data: {
                currentScore: score,
                tier,
                factors,
                borrowingLimit: CreditScoreService.getBorrowingLimit(score),
                interestRate: CreditScoreService.getInterestRate(score),
                history: {
                    timelyRepayments: user.timelyRepayments,
                    lateRepayments: user.lateRepayments
                }
            }
        });
    } catch (error) {
        logger.error('Get credit score error:', error);
        res.status(500).json({ success: false, message: 'Failed to get credit score', error: error.message });
    }
};

// @desc    Get borrowing history
// @route   GET /api/users/history/borrowing
// @access  Private
const getBorrowingHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const loans = await Loan.find({ borrower: req.user.id })
            .populate('lender', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Loan.countDocuments({ borrower: req.user.id });

        // Calculate statistics
        const stats = {
            totalBorrowed: loans.reduce((sum, loan) => sum + loan.principal, 0),
            totalRepaid: loans.reduce((sum, loan) => sum + loan.amountPaid, 0),
            activeLoans: loans.filter(l => l.status === 'active').length,
            completedLoans: loans.filter(l => l.status === 'repaid').length,
            defaultedLoans: loans.filter(l => l.status === 'defaulted').length
        };

        res.json({
            success: true,
            data: loans,
            stats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Get borrowing history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get borrowing history',
            error: error.message
        });
    }
};

// @desc    Get lending history
// @route   GET /api/users/history/lending
// @access  Private
const getLendingHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const loans = await Loan.find({ lender: req.user.id })
            .populate('borrower', 'name email creditScore')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Loan.countDocuments({ lender: req.user.id });

        // Calculate ROI
        const stats = {
            totalLent: loans.reduce((sum, loan) => sum + loan.principal, 0),
            totalReceived: loans.reduce((sum, loan) => sum + loan.amountPaid, 0),
            activeLoans: loans.filter(l => l.status === 'active').length,
            completedLoans: loans.filter(l => l.status === 'repaid').length,
            defaultedLoans: loans.filter(l => l.status === 'defaulted').length,
            totalInterest: loans.reduce((sum, loan) => {
                if (loan.status === 'repaid') {
                    return sum + (loan.totalRepayable - loan.principal);
                }
                return sum;
            }, 0)
        };

        stats.roi = stats.totalLent > 0 
            ? ((stats.totalReceived - stats.totalLent) / stats.totalLent * 100).toFixed(2)
            : 0;

        res.json({
            success: true,
            data: loans,
            stats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Get lending history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get lending history',
            error: error.message
        });
    }
};

// @desc    Get user badges
// @route   GET /api/users/badges
// @access  Private
const getBadges = async (req, res) => {
    try {
        const userBadges = await UserBadge.find({ user: req.user.id })
            .populate('badge')
            .sort({ earnedAt: -1 });

        // Group by category
        const grouped = userBadges.reduce((acc, ub) => {
            const category = ub.badge.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(ub);
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                total: userBadges.length,
                grouped,
                recent: userBadges.slice(0, 5)
            }
        });
    } catch (error) {
        logger.error('Get badges error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get badges',
            error: error.message
        });
    }
};

// @desc    Get user stats
// @route   GET /api/users/stats
// @access  Private
const getUserStats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get wallet
        const wallet = await Wallet.findOne({ user: userId });

        // Get loan stats
        const loanStats = await Loan.aggregate([
            { $match: { borrower: mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$principal' }
                }
            }
        ]);

        // Get transaction stats
        const transactionStats = await Transaction.aggregate([
            { 
                $match: { 
                    $or: [
                        { fromUser: mongoose.Types.ObjectId(userId) },
                        { toUser: mongoose.Types.ObjectId(userId) }
                    ]
                }
            },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        // Get streak info
        const streak = await calculateStreak(userId);

        res.json({
            success: true,
            data: {
                wallet: {
                    balance: wallet.balance,
                    lockedBalance: wallet.lockedBalance,
                    availableBalance: wallet.availableBalance
                },
                loans: loanStats,
                transactions: transactionStats,
                streak,
                tier: req.user.tier,
                creditScore: req.user.creditScore
            }
        });
    } catch (error) {
        logger.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user stats',
            error: error.message
        });
    }
};

// Helper function to calculate streak
const calculateStreak = async (userId) => {
    const loans = await Loan.find({
        borrower: userId,
        status: 'repaid'
    }).sort({ completedDate: -1 });

    if (loans.length === 0) {
        return { current: 0, longest: 0 };
    }

    let currentStreak = 1;
    let longestStreak = 1;
    let previousDate = loans[0].completedDate;

    for (let i = 1; i < loans.length; i++) {
        const daysDiff = Math.abs((loans[i].completedDate - previousDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 7) { // Within a week
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 1;
        }
        
        previousDate = loans[i].completedDate;
    }

    return { current: currentStreak, longest: longestStreak };
};

module.exports = {
    getProfile,
    updateProfile,
    uploadKYC,
    getCreditScore,
    getBorrowingHistory,
    getLendingHistory,
    getBadges,
    getUserStats
};