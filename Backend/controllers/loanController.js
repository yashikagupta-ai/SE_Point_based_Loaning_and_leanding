// controllers/loanController.js
const LoanRequest = require('../models/LoanRequest');
const Loan = require('../models/Loan');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const CreditScoreService = require('../services/creditScoreService');
const InterestCalculator = require('../services/interestCalculator');
const notificationService = require('../services/notificationService');
const fraudDetectionService = require('../services/fraudDetectionService');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// @desc    Create a loan request
// @route   POST /api/loans/request
// @access  Private
const createLoanRequest = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { amount, purpose, duration, itemName } = req.body;
        const borrowerId = req.user.id;

        // Check if user is KYC verified
        if (!req.user.isKYCVerified) {
            return res.status(403).json({
                success: false,
                message: 'KYC verification required to post item borrow requests'
            });
        }

        // Check borrowing limit based on trust score
        const borrowingLimit = CreditScoreService.getBorrowingLimit(req.user.creditScore);
        if (amount > borrowingLimit) {
            return res.status(400).json({
                success: false,
                message: `Requested amount exceeds your borrowing limit of ${borrowingLimit} points`
            });
        }

        // Calculate fee rate based on trust score
        const interestRate = CreditScoreService.getInterestRate(req.user.creditScore);

        // Check for fraudulent behavior
        const fraudAnalysis = await fraudDetectionService.analyzeUser(borrowerId);
        if (fraudAnalysis.riskLevel === 'HIGH') {
            await fraudDetectionService.generateAlert(
                borrowerId,
                'High risk item borrow request attempt',
                'HIGH'
            );
            
            return res.status(403).json({
                success: false,
                message: 'Your account is under review. Please contact support.'
            });
        }

        // Create item borrow request
        const loanRequest = await LoanRequest.create([{
            borrower: borrowerId,
            itemName: itemName || purpose || 'Unnamed item',
            amount,
            purpose,
            duration,
            interestRate,
            creditScoreAtRequest: req.user.creditScore
        }], { session });

        await session.commitTransaction();

        // Notify potential lenders (would be implemented with WebSockets)
        logger.info(`Loan request created: ${loanRequest[0]._id}`);

        res.status(201).json({
            success: true,
            data: loanRequest[0],
            message: 'Loan request created successfully'
        });

    } catch (error) {
        await session.abortTransaction();
        logger.error('Create loan request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create loan request',
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Get all loan requests
// @route   GET /api/loans/requests
// @access  Private
const getLoanRequests = async (req, res) => {
    try {
        const { status = 'pending', page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const query = { status };
        
        // If user is not admin, filter by their role
        if (req.user.role !== 'admin') {
            // For lenders, show all pending requests except their own
            // For borrowers, show only their requests
            if (req.user.role === 'user') {
                query.borrower = { $ne: req.user.id };
            }
        }

        const loanRequests = await LoanRequest.find(query)
            .populate('borrower', 'name email creditScore')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await LoanRequest.countDocuments(query);

        // Enhance with additional data for lenders
        if (req.user.role === 'user') {
            const wallet = await Wallet.findOne({ user: req.user.id });
            
            for (const request of loanRequests) {
                request.canLend = wallet.availableBalance >= request.amount;
                request.riskLevel = await calculateRiskLevel(request.borrower);
            }
        }

        res.json({
            success: true,
            data: loanRequests,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Get loan requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get loan requests',
            error: error.message
        });
    }
};

// @desc    Get loan request by ID
// @route   GET /api/loans/request/:id
// @access  Private
const getLoanRequestById = async (req, res) => {
    try {
        const loanRequest = await LoanRequest.findById(req.params.id)
            .populate('borrower', 'name email creditScore totalBorrowed timelyRepayments');

        if (!loanRequest) {
            return res.status(404).json({
                success: false,
                message: 'Loan request not found'
            });
        }

        // Check authorization
        if (req.user.role !== 'admin' && 
            loanRequest.borrower._id.toString() !== req.user.id) {
            
            // For lenders, show additional analysis
            if (req.user.role === 'user') {
                const wallet = await Wallet.findOne({ user: req.user.id });
                const loanRequestObj = loanRequest.toObject();
                loanRequestObj.canLend = wallet.availableBalance >= loanRequest.amount;
                loanRequestObj.riskAnalysis = await analyzeBorrowerRisk(loanRequest.borrower);
                
                return res.json({
                    success: true,
                    data: loanRequestObj
                });
            }
            
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this request'
            });
        }

        res.json({
            success: true,
            data: loanRequest
        });
    } catch (error) {
        logger.error('Get loan request by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get loan request',
            error: error.message
        });
    }
};

// @desc    Approve loan request
// @route   POST /api/loans/request/:id/approve
// @access  Private (Lenders)
const approveLoan = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const loanRequest = await LoanRequest.findById(req.params.id)
            .populate('borrower');

        if (!loanRequest) {
            return res.status(404).json({
                success: false,
                message: 'Loan request not found'
            });
        }

        // Validate request status
        if (loanRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Loan request is already ${loanRequest.status}`
            });
        }

        // Check if user is trying to lend to themselves
        if (loanRequest.borrower._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot lend to yourself'
            });
        }

        // Check lender's wallet balance
        const lenderWallet = await Wallet.findOne({ user: req.user.id });
        if (!lenderWallet.hasSufficientBalance(loanRequest.amount)) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance in your wallet'
            });
        }

        // Calculate total repayable amount
        const totalRepayable = InterestCalculator.calculateTotalRepayable(
            loanRequest.amount,
            loanRequest.interestRate,
            loanRequest.duration
        );

        // Create loan
        const loan = await Loan.create([{
            loanRequest: loanRequest._id,
            borrower: loanRequest.borrower._id,
            lender: req.user.id,
            principal: loanRequest.amount,
            interestRate: loanRequest.interestRate,
            totalRepayable,
            dueDate: new Date(Date.now() + loanRequest.duration * 24 * 60 * 60 * 1000)
        }], { session });

        // Update loan request status
        await loanRequest.approve(req.user.id);

        // Deduct points from lender's wallet
        lenderWallet.deductPoints(loanRequest.amount, 'Loan disbursement');
        lenderWallet.lockedBalance += loanRequest.amount;
        await lenderWallet.save({ session });

        // Add points to borrower's wallet
        const borrowerWallet = await Wallet.findOne({ user: loanRequest.borrower._id });
        borrowerWallet.addPoints(loanRequest.amount, 'Loan received');
        await borrowerWallet.save({ session });

        // Create transaction record
        await Transaction.create([{
            type: 'loan_created',
            fromUser: req.user.id,
            toUser: loanRequest.borrower._id,
            fromWallet: lenderWallet._id,
            toWallet: borrowerWallet._id,
            amount: loanRequest.amount,
            description: `Loan disbursement for request ${loanRequest._id}`,
            reference: loanRequest._id,
            referenceModel: 'LoanRequest'
        }], { session });

        // Update user stats
        await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { totalLent: loanRequest.amount } },
            { session }
        );

        await User.findByIdAndUpdate(
            loanRequest.borrower._id,
            { $inc: { totalBorrowed: loanRequest.amount } },
            { session }
        );

        await session.commitTransaction();

        // Send notifications
        await notificationService.sendLoanApproved(
            loanRequest.borrower._id,
            {
                amount: loanRequest.amount,
                interestRate: loanRequest.interestRate,
                dueDate: loan[0].dueDate
            }
        );

        logger.info(`Loan approved: ${loan[0]._id} by lender ${req.user.id}`);

        res.json({
            success: true,
            data: loan[0],
            message: 'Loan approved and disbursed successfully'
        });

    } catch (error) {
        await session.abortTransaction();
        logger.error('Approve loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve loan',
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Reject loan request
// @route   POST /api/loans/request/:id/reject
// @access  Private (Anyone can reject their own request, or admin)
const rejectLoan = async (req, res) => {
    try {
        const { reason } = req.body;
        const loanRequest = await LoanRequest.findById(req.params.id);

        if (!loanRequest) {
            return res.status(404).json({
                success: false,
                message: 'Loan request not found'
            });
        }

        // Check authorization
        if (req.user.role !== 'admin' && 
            loanRequest.borrower.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to reject this request'
            });
        }

        // Validate request status
        if (loanRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Loan request is already ${loanRequest.status}`
            });
        }

        loanRequest.reject(reason || 'Rejected by user');
        await loanRequest.save();

        res.json({
            success: true,
            message: 'Loan request rejected successfully'
        });

    } catch (error) {
        logger.error('Reject loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject loan',
            error: error.message
        });
    }
};

// @desc    Repay loan
// @route   POST /api/loans/:id/repay
// @access  Private (Borrower only)
const repayLoan = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { amount } = req.body;
        const loan = await Loan.findById(req.params.id)
            .populate('borrower')
            .populate('lender');

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        // Check if user is the borrower
        if (loan.borrower._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Only the borrower can repay this loan'
            });
        }

        // Check loan status
        if (loan.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: `Loan is already ${loan.status}`
            });
        }

        // Calculate interest up to current date
        loan.calculateInterest();

        // Check if loan is overdue and apply penalty
        if (loan.isOverdue) {
            loan.applyLatePenalty();
        }

        // Validate repayment amount
        if (amount > loan.outstanding) {
            return res.status(400).json({
                success: false,
                message: `Repayment amount exceeds outstanding balance of ${loan.outstanding}`
            });
        }

        // Check borrower's wallet balance
        const borrowerWallet = await Wallet.findOne({ user: req.user.id });
        if (!borrowerWallet.hasSufficientBalance(amount)) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance in your wallet'
            });
        }

        // Process repayment
        borrowerWallet.deductPoints(amount, 'Loan repayment');
        await borrowerWallet.save({ session });

        // Update loan
        loan.amountPaid += amount;
        loan.repaymentHistory.push({
            amount,
            date: new Date()
        });

        // Check if loan is fully repaid
        if (Math.abs(loan.outstanding) < 0.01) { // Floating point tolerance
            loan.status = 'repaid';
            loan.completedDate = new Date();
            
            // Update user stats for timely repayment
            if (!loan.isLate) {
                await User.findByIdAndUpdate(
                    req.user.id,
                    { $inc: { timelyRepayments: 1 } },
                    { session }
                );
            }
            
            // Release locked balance from lender
            const lenderWallet = await Wallet.findOne({ user: loan.lender._id });
            lenderWallet.lockedBalance -= loan.principal;
            await lenderWallet.save({ session });
        }

        await loan.save({ session });

        // Transfer points to lender
        const lenderWallet = await Wallet.findOne({ user: loan.lender._id });
        lenderWallet.addPoints(amount, 'Loan repayment received');
        await lenderWallet.save({ session });

        // Create transaction record
        await Transaction.create([{
            type: 'loan_repayment',
            fromUser: req.user.id,
            toUser: loan.lender._id,
            fromWallet: borrowerWallet._id,
            toWallet: lenderWallet._id,
            amount,
            description: `Loan repayment for loan ${loan._id}`,
            reference: loan._id,
            referenceModel: 'Loan'
        }], { session });

        await session.commitTransaction();

        // Update credit scores
        const newBorrowerScore = await CreditScoreService.calculateScore(req.user.id);
        await User.findByIdAndUpdate(req.user.id, { creditScore: newBorrowerScore });

        const newLenderScore = await CreditScoreService.calculateScore(loan.lender._id);
        await User.findByIdAndUpdate(loan.lender._id, { creditScore: newLenderScore });

        res.json({
            success: true,
            data: {
                loan,
                remainingBalance: loan.outstanding,
                isFullyRepaid: loan.status === 'repaid'
            },
            message: loan.status === 'repaid' 
                ? 'Loan fully repaid successfully!' 
                : `Repayment of ${amount} points processed successfully`
        });

    } catch (error) {
        await session.abortTransaction();
        logger.error('Repay loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process repayment',
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

// @desc    Get active loans for user
// @route   GET /api/loans/active
// @access  Private
const getActiveLoans = async (req, res) => {
    try {
        const loans = await Loan.find({
            $or: [
                { borrower: req.user.id },
                { lender: req.user.id }
            ],
            status: 'active'
        })
        .populate('borrower', 'name email creditScore')
        .populate('lender', 'name email creditScore')
        .sort({ dueDate: 1 });

        // Calculate current outstanding and interest for each loan
        const enhancedLoans = [];
        for (const loan of loans) {
            const loanObj = loan.toObject();
            loan.calculateInterest();
            
            if (loan.isOverdue) {
                loan.applyLatePenalty();
                await loan.save();
            }
            
            loanObj.currentOutstanding = loan.outstanding;
            loanObj.daysUntilDue = Math.ceil((loan.dueDate - new Date()) / (1000 * 60 * 60 * 24));
            loanObj.isOverdue = loan.isOverdue;
            
            enhancedLoans.push(loanObj);
        }

        res.json({
            success: true,
            data: enhancedLoans
        });
    } catch (error) {
        logger.error('Get active loans error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get active loans',
            error: error.message
        });
    }
};

// @desc    Get loan by ID
// @route   GET /api/loans/:id
// @access  Private
const getLoanById = async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id)
            .populate('borrower', 'name email creditScore')
            .populate('lender', 'name email creditScore')
            .populate('loanRequest');

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        // Check authorization
        if (req.user.role !== 'admin' &&
            loan.borrower._id.toString() !== req.user.id &&
            loan.lender._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this loan'
            });
        }

        // Calculate current interest
        loan.calculateInterest();
        const loanObj = loan.toObject();
        loanObj.currentOutstanding = loan.outstanding;
        loanObj.interestAccruedToday = InterestCalculator.calculateDailyInterest(
            loan.principal,
            loan.interestRate
        );

        res.json({
            success: true,
            data: loanObj
        });
    } catch (error) {
        logger.error('Get loan by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get loan',
            error: error.message
        });
    }
};

// @desc    Calculate repayment amount
// @route   GET /api/loans/calculate/:amount/:duration
// @access  Private
const calculateRepaymentAmount = async (req, res) => {
    try {
        const { amount, duration } = req.params;
        
        // Get user's credit score
        const user = await User.findById(req.user.id);
        const interestRate = CreditScoreService.getInterestRate(user.creditScore);
        
        const totalRepayable = InterestCalculator.calculateTotalRepayable(
            parseFloat(amount),
            interestRate,
            parseInt(duration)
        );

        const dailyInterest = InterestCalculator.calculateDailyInterest(
            parseFloat(amount),
            interestRate
        );

        res.json({
            success: true,
            data: {
                principal: parseFloat(amount),
                interestRate,
                duration: parseInt(duration),
                totalRepayable,
                dailyInterest,
                interestAmount: totalRepayable - parseFloat(amount)
            }
        });
    } catch (error) {
        logger.error('Calculate repayment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate repayment',
            error: error.message
        });
    }
};

// Helper functions
const calculateRiskLevel = async (borrower) => {
    if (borrower.creditScore >= 750) return 'LOW';
    if (borrower.creditScore >= 600) return 'MEDIUM';
    return 'HIGH';
};

const analyzeBorrowerRisk = async (borrower) => {
    const totalLoans = borrower.totalBorrowed || 0;
    const timelyRate = borrower.timelyRepayments / (borrower.timelyRepayments + borrower.lateRepayments || 1);
    
    return {
        creditScore: borrower.creditScore,
        totalBorrowed: totalLoans,
        timelyRepaymentRate: (timelyRate * 100).toFixed(2) + '%',
        riskLevel: await calculateRiskLevel(borrower)
    };
};

module.exports = {
    createLoanRequest,
    getLoanRequests,
    getLoanRequestById,
    approveLoan,
    rejectLoan,
    repayLoan,
    getActiveLoans,
    getLoanById,
    calculateRepaymentAmount
};