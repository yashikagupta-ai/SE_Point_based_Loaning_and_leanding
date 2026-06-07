// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');

// Ensure KYC upload directory exists at startup
const kycDir = path.join(__dirname, '..', 'uploads', 'kyc');
if (!fs.existsSync(kycDir)) {
    fs.mkdirSync(kycDir, { recursive: true });
}
const { validate, checkValidation } = require('../utils/validators');
const {
    getProfile,
    updateProfile,
    uploadKYC,
    getCreditScore,
    getBorrowingHistory,
    getLendingHistory,
    getBadges,
    getUserStats
} = require('../controllers/userController');

// Multer configuration for KYC file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, kycDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `kyc-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only .jpg, .jpeg, .png and .pdf files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// All routes are protected
router.use(protect);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', validate.register, checkValidation, updateProfile);

// KYC route with multer error handling
router.post('/kyc', (req, res, next) => {
    upload.single('document')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5 MB.' });
            }
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, uploadKYC);

// Credit score routes
router.get('/credit-score', getCreditScore);

// History routes
router.get('/history/borrowing', getBorrowingHistory);
router.get('/history/lending', getLendingHistory);

// Badges and stats
router.get('/badges', getBadges);
router.get('/stats', getUserStats);

module.exports = router;