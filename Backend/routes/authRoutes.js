const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { 
    register, 
    login, 
    getMe, 
    logout,
    forgotPassword 
} = require('../controllers/authController');

// Validation rules
const registerValidation = [
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
        .withMessage('Password must be at least 6 characters'),
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
];

const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.post('/forgot-password', forgotPassword);

module.exports = router;