// routes/loanRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { loanLimiter } = require('../middleware/rateLimiter');
const { validate, checkValidation } = require('../utils/validators');
const {
    createLoanRequest,
    getLoanRequests,
    getLoanRequestById,
    approveLoan,
    rejectLoan,
    repayLoan,
    getActiveLoans,
    getLoanById,
    calculateRepaymentAmount
} = require('../controllers/loanController');

// All routes are protected
router.use(protect);

// Loan request routes
router.post('/request', loanLimiter, validate.loanRequest, checkValidation, createLoanRequest);
router.get('/requests', getLoanRequests);
router.get('/request/:id', getLoanRequestById);
router.post('/request/:id/approve', approveLoan);
router.post('/request/:id/reject', rejectLoan);

// Active loan routes
router.get('/active', getActiveLoans);
router.get('/:id', getLoanById);
router.post('/:id/repay', validate.repayment, checkValidation, repayLoan);

// Utility routes
router.get('/calculate/:amount/:duration', calculateRepaymentAmount);

module.exports = router;