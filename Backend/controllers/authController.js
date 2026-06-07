const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Settings = require('../models/Settings');
const LoginAttempt = require('../models/LoginAttempt');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password, name } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create user
        const user = await User.create({
            email,
            password,
            name
        });

        // Create wallet for user with signup bonus
        const signupBonus = await Settings.get('signup_bonus_points', 100);
        await Wallet.create({
            user: user._id,
            balance: signupBonus, // Signup bonus (configurable by admin)
            totalEarned: 100
        });

        // Generate token
        const token = generateToken(user._id);

        // Remove password from response
        user.password = undefined;

        res.status(201).json({
            success: true,
            token,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                creditScore: user.creditScore
            },
            message: 'Registration successful! Welcome bonus of 100 points added.'
        });

    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;

        // Check login attempts
        let loginAttempt = await LoginAttempt.findOne({ email, ipAddress });
        
        if (loginAttempt && loginAttempt.isLocked()) {
            const minutesLeft = Math.ceil((loginAttempt.lockedUntil - new Date()) / (1000 * 60));
            return res.status(429).json({
                success: false,
                message: `Too many failed attempts. Try again after ${minutesLeft} minutes.`
            });
        }

        // Check if user exists
        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            // Record failed attempt for non-existent user
            if (!loginAttempt) {
                await LoginAttempt.create({
                    email,
                    ipAddress,
                    attempts: 1
                });
            } else {
                loginAttempt.incrementAttempt();
                await loginAttempt.save();
            }

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isPasswordMatch = await user.comparePassword(password);
        
        if (!isPasswordMatch) {
            // Record failed attempt
            if (!loginAttempt) {
                await LoginAttempt.create({
                    email,
                    ipAddress,
                    attempts: 1
                });
            } else {
                loginAttempt.incrementAttempt();
                await loginAttempt.save();
            }

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact admin.'
            });
        }

        // Admins are auto-verified — no KYC needed
        if (user.role === 'admin' && !user.isKYCVerified) {
            user.isKYCVerified = true;
            await user.save();
        }

        // Successful login - reset attempts
        if (loginAttempt) {
            loginAttempt.reset();
            await loginAttempt.save();
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        // Remove password from response
        user.password = undefined;

        // Get wallet balance
        const wallet = await Wallet.findOne({ user: user._id });

        res.json({
            success: true,
            token,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                creditScore: user.creditScore,
                isKYCVerified: user.isKYCVerified,
                walletBalance: wallet ? wallet.balance : 0,
                tier: user.tier
            },
            message: 'Login successful'
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password')
            .lean();

        const wallet = await Wallet.findOne({ user: user._id }).lean();

        res.json({
            success: true,
            data: {
                ...user,
                walletBalance: wallet ? wallet.balance : 0,
                availableBalance: wallet ? wallet.availableBalance : 0
            }
        });

    } catch (error) {
        logger.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user data',
            error: error.message
        });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
    try {
        // With JWT, logout is handled client-side by removing token
        // But we can log the logout event
        logger.info(`User logged out: ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: error.message
        });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        
        if (!user) {
            // Don't reveal if user exists or not for security
            return res.json({
                success: true,
                message: 'If your email is registered, you will receive a password reset link'
            });
        }

        // Generate reset token (simplified - in production, save this to user model)
        const resetToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET + user.password,
            { expiresIn: '10m' }
        );

        // Log the reset token (in production, send email)
        logger.info(`Password reset token for ${email}: ${resetToken}`);

        res.json({
            success: true,
            message: 'If your email is registered, you will receive a password reset link'
        });

    } catch (error) {
        logger.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process request',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    getMe,
    logout,
    forgotPassword
};