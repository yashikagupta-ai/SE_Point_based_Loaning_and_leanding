// utils/validators.js
const { body, validationResult } = require('express-validator');

// Validation rules
const validate = {
    // Register validation
    register: [
        body('email')
            .isEmail()
            .normalizeEmail()
            .custom(value => {
                if (!value.endsWith('@mahindrauniversity.edu.in')) {
                    throw new Error('Only Mahindra University email addresses are allowed');
                }
                return true;
            }),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long')
            .matches(/\d/)
            .withMessage('Password must contain at least one number'),
        body('name')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters')
            .matches(/^[a-zA-Z\s]+$/)
            .withMessage('Name can only contain letters and spaces')
    ],
    
    // Login validation
    login: [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty().withMessage('Password is required')
    ],
    
    // Loan request validation
    loanRequest: [
        body('amount')
            .isInt({ min: 10, max: 10000 })
            .withMessage('Amount must be between 10 and 10000 points'),
        body('purpose')
            .trim()
            .isLength({ min: 10, max: 200 })
            .withMessage('Purpose must be between 10 and 200 characters'),
        body('duration')
            .isInt({ min: 1, max: 365 })
            .withMessage('Duration must be between 1 and 365 days')
    ],
    
    // Repayment validation
    repayment: [
        body('amount')
            .isInt({ min: 1 })
            .withMessage('Amount must be at least 1 point')
    ],
    
    // KYC upload validation
    kycUpload: [
        body('documentType')
            .isIn(['student_id', 'passport', 'drivers_license'])
            .withMessage('Invalid document type')
    ]
};

// Validation result checker
const checkValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

module.exports = {
    validate,
    checkValidation
};