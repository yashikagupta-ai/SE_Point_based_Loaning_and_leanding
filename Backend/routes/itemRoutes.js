// routes/itemRoutes.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { protect } = require('../middleware/authMiddleware');
const {
    createListing, getListings, getListing,
    requestBorrow, approveBorrow, rejectBorrow, returnItem, unlistItem, relistItem
} = require('../controllers/itemController');
const ItemListing = require('../models/ItemListing');

const itemImgDir = path.join(__dirname, '..', 'uploads', 'items');
if (!fs.existsSync(itemImgDir)) fs.mkdirSync(itemImgDir, { recursive: true });

const itemImgStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, itemImgDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `item-${req.user?.id ?? 'u'}-${unique}${path.extname(file.originalname)}`);
    }
});
const itemUpload = multer({
    storage: itemImgStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (/jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase()) &&
            /image\//.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (jpg, png, webp) are allowed'));
        }
    }
});

router.use(protect);

router.get('/',          getListings);
router.post('/',         itemUpload.single('image'), createListing);
router.get('/:id',       getListing);
router.delete('/:id',    unlistItem);

// Hard delete — only by the lender themselves (not while borrowed)
router.delete('/:id/hard', async (req, res) => {
    try {
        const listing = await ItemListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ success: false, message: 'Not found' });
        if (listing.lender.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: 'Not authorized' });
        if (listing.status === 'borrowed')
            return res.status(400).json({ success: false, message: 'Cannot delete while borrowed' });
        await ItemListing.deleteOne({ _id: listing._id });
        if (global.io) global.io.to('global').emit('item_status_changed', { id: listing._id, status: 'deleted' });
        res.json({ success: true, message: 'Item permanently deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/:id/relist',                         relistItem);
router.post('/:id/request',                        requestBorrow);
router.post('/:id/requests/:reqId/approve',        approveBorrow);
router.post('/:id/requests/:reqId/reject',         rejectBorrow);
router.post('/:id/return',                         returnItem);

module.exports = router;
