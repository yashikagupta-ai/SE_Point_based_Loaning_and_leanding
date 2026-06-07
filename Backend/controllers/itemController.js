// controllers/itemController.js
const ItemListing        = require('../models/ItemListing');
const Wallet             = require('../models/Wallet');
const Transaction        = require('../models/Transaction');
const User               = require('../models/User');
const Settings           = require('../models/Settings');
const logger             = require('../utils/logger');
const mongoose           = require('mongoose');
const createNotification = require('../utils/createNotification');

// helper to emit global item update
const emitItemUpdate = (event, data) => {
    if (global.io) global.io.to('global').emit(event, data);
};

// ── Lender: post a new item ──────────────────────────────────────────────────
const createListing = async (req, res) => {
    try {
        const { itemName, description, category, pointsPerDay, maxDuration, condition } = req.body;

        if (!itemName || !description || !pointsPerDay) {
            return res.status(400).json({ success: false, message: 'itemName, description and pointsPerDay are required' });
        }

        // Load admin-configurable limits
        const maxPointsPerDay    = await Settings.get('max_points_per_day', 1000);
        const defaultMaxDuration = await Settings.get('max_loan_duration_days', 30);

        if (Number(pointsPerDay) > maxPointsPerDay) {
            return res.status(400).json({ success: false, message: `Maximum allowed points per day is ${maxPointsPerDay}` });
        }

        const images = req.file ? [`/uploads/items/${req.file.filename}`] : [];

        const listing = await ItemListing.create({
            lender: req.user.id,
            itemName,
            description,
            category: category || 'other',
            pointsPerDay: Number(pointsPerDay),
            maxDuration:  Number(maxDuration) || defaultMaxDuration,
            condition:    condition || 'good',
            images
        });

        const populated = await ItemListing.findById(listing._id)
            .populate('lender', 'name email tier');

        // Emit to all connected clients so item market updates in real-time
        emitItemUpdate('item_created', populated);

        res.status(201).json({ success: true, data: listing, message: 'Item listed successfully' });
    } catch (err) {
        logger.error('Create listing error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Anyone: browse available items ──────────────────────────────────────────
const getListings = async (req, res) => {
    try {
        const { category, page = 1, limit = 20, mine, borrowedByMe } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        if (mine === 'true') {
            query = { lender: req.user.id };
        } else if (borrowedByMe === 'true') {
            query = { currentBorrower: req.user.id };
        } else {
            query = { status: 'available', lender: { $ne: req.user.id } };
        }

        if (category) query.category = category;

        const [listings, total] = await Promise.all([
            ItemListing.find(query)
                .populate('lender', 'name email tier')
                .populate('currentBorrower', 'name email')
                .populate('borrowRequests.borrower', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            ItemListing.countDocuments(query)
        ]);

        res.json({ success: true, data: listings, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
    } catch (err) {
        logger.error('Get listings error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Anyone: get single listing ───────────────────────────────────────────────
const getListing = async (req, res) => {
    try {
        const listing = await ItemListing.findById(req.params.id)
            .populate('lender', 'name email tier isKYCVerified')
            .populate('currentBorrower', 'name email')
            .populate('borrowRequests.borrower', 'name email');

        if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
        res.json({ success: true, data: listing });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Borrower: request to borrow ──────────────────────────────────────────────
const requestBorrow = async (req, res) => {
    try {
        const { message, duration } = req.body;
        const days = Number(duration) || 1;

        const borrower = await User.findById(req.user.id);
        if (!borrower || !borrower.isKYCVerified) {
            return res.status(403).json({
                success: false,
                message: 'KYC verification is required before borrowing items. Please verify your student ID in your Profile.'
            });
        }

        const listing = await ItemListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });

        if (listing.lender.toString() === req.user.id)
            return res.status(400).json({ success: false, message: 'You cannot borrow your own item' });

        if (listing.status !== 'available')
            return res.status(400).json({ success: false, message: 'Item is not available' });

        if (days > listing.maxDuration)
            return res.status(400).json({ success: false, message: `Max borrow duration is ${listing.maxDuration} days` });

        const totalPoints = listing.pointsPerDay * days;

        const borrowerWallet = await Wallet.findOne({ user: req.user.id });
        const available = borrowerWallet ? (borrowerWallet.balance - borrowerWallet.lockedBalance) : 0;
        if (!borrowerWallet || available < totalPoints)
            return res.status(400).json({ success: false, message: `Insufficient points. Need ${totalPoints} pts (you have ${available} available)` });

        const already = listing.borrowRequests.find(
            r => r.borrower.toString() === req.user.id && r.status === 'pending'
        );
        if (already) return res.status(400).json({ success: false, message: 'You already have a pending request for this item' });

        await Wallet.findOneAndUpdate(
            { user: req.user.id },
            { $inc: { balance: -totalPoints, lockedBalance: totalPoints, totalSpent: totalPoints },
              $set:  { lastTransactionAt: new Date() } }
        );

        listing.borrowRequests.push({
            borrower:    req.user.id,
            message:     message || '',
            status:      'pending',
            duration:    days,
            totalPoints: totalPoints
        });
        await listing.save();

        await Transaction.create({
            type:        'loan_created',
            fromUser:    req.user.id,
            toUser:      listing.lender,
            amount:      totalPoints,
            description: `Payment for borrowing "${listing.itemName}"`,
            status:      'pending',
            listingId:   listing._id,
            metadata:    new Map([['duration', String(days)]])
        });

        await createNotification({
            user:         listing.lender,
            type:         'borrow_request',
            title:        '📦 New Borrow Request',
            message:      `${borrower.name} wants to borrow "${listing.itemName}" for ${days} day${days > 1 ? 's' : ''} (${totalPoints} pts).`,
            relatedId:    listing._id,
            relatedModel: 'ItemListing'
        });

        // Emit notification update to lender
        if (global.io) global.io.to(listing.lender.toString()).emit('notification_update', {});
        // Emit wallet update to borrower
        if (global.io) global.io.to(req.user.id).emit('wallet_update', {});

        res.status(201).json({ success: true, message: `Borrow request sent! ${totalPoints} pts reserved pending owner approval.` });
    } catch (err) {
        logger.error('Request borrow error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Lender: approve a borrow request ────────────────────────────────────────
const approveBorrow = async (req, res) => {
    try {
        const listing = await ItemListing.findById(req.params.id)
            .populate('borrowRequests.borrower', 'name email');
        if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });

        if (listing.lender.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: 'Only the lender can approve' });

        const request = listing.borrowRequests.id(req.params.reqId);
        if (!request) return res.status(404).json({ success: false, message: 'Borrow request not found' });
        if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already handled' });

        const originalPoints = (request.totalPoints || listing.pointsPerDay);
        const borrowerId = request.borrower?._id?.toString() || request.borrower.toString();

        // Support negotiated lower price: lender can pass agreedPoints in body
        let agreedPoints = originalPoints;
        if (req.body && req.body.agreedPoints !== undefined) {
            const parsed = Number(req.body.agreedPoints);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                return res.status(400).json({ success: false, message: 'agreedPoints must be a positive number' });
            }
            if (parsed > originalPoints) {
                return res.status(400).json({ success: false, message: `agreedPoints cannot exceed the original requested amount of ${originalPoints} pts` });
            }
            agreedPoints = parsed;
        }

        const refundDiff = originalPoints - agreedPoints; // points to refund back to borrower if lower price

        // Release lock on borrower wallet; refund any difference above agreed price
        await Wallet.findOneAndUpdate(
            { user: borrowerId },
            {
                $inc: {
                    lockedBalance: -originalPoints,
                    balance: refundDiff,           // 0 if no discount; positive if negotiated lower
                    totalSpent: -refundDiff         // correct totalSpent to reflect actual spend
                },
                $set: { lastTransactionAt: new Date() }
            }
        );

        // Credit lender with agreed (possibly lower) amount
        await Wallet.findOneAndUpdate(
            { user: req.user.id },
            { $inc: { balance: agreedPoints, totalEarned: agreedPoints }, $set: { lastTransactionAt: new Date() } }
        );

        // Reject all other pending requests and refund
        for (const r of listing.borrowRequests) {
            if (r._id.toString() === req.params.reqId || r.status !== 'pending') continue;
            const pts = r.totalPoints || listing.pointsPerDay;
            const rid = r.borrower?._id?.toString() || r.borrower.toString();
            await Wallet.findOneAndUpdate(
                { user: rid },
                { $inc: { balance: pts, lockedBalance: -pts, totalSpent: -pts }, $set: { lastTransactionAt: new Date() } }
            );
            r.status = 'rejected';
            r.rejectionReason = 'Another request was approved';
            if (global.io) global.io.to(rid).emit('wallet_update', {});
            if (global.io) global.io.to(rid).emit('myitems_update', {});
        }

        request.status     = 'approved';
        request.approvedAt = new Date();
        if (agreedPoints !== originalPoints) {
            request.agreedPoints = agreedPoints; // record the negotiated amount
        }

        listing.status          = 'borrowed';
        listing.isAvailable     = false;
        listing.currentBorrower = borrowerId;
        await listing.save();

        await Transaction.findOneAndUpdate(
            { fromUser: borrowerId, listingId: listing._id, status: 'pending' },
            { status: 'completed', amount: agreedPoints, description: `Payment for borrowing "${listing.itemName}"${agreedPoints !== originalPoints ? ` (negotiated from ${originalPoints} pts)` : ''}` }
        );

        await User.findByIdAndUpdate(listing.lender,   { $inc: { totalLent:     agreedPoints } });
        await User.findByIdAndUpdate(borrowerId,        { $inc: { totalBorrowed: agreedPoints } });

        await createNotification({
            user:         borrowerId,
            type:         'borrow_approved',
            title:        '✅ Borrow Request Approved!',
            message:      agreedPoints !== originalPoints
                ? `Your request to borrow "${listing.itemName}" was approved at a negotiated price of ${agreedPoints} pts (originally ${originalPoints} pts). Enjoy!`
                : `Your request to borrow "${listing.itemName}" was approved. Enjoy!`,
            relatedId:    listing._id,
            relatedModel: 'ItemListing'
        });

        // Real-time updates
        if (global.io) {
            global.io.to(borrowerId).emit('notification_update', {});
            global.io.to(borrowerId).emit('wallet_update', {});
            global.io.to(borrowerId).emit('myitems_update', {});
            global.io.to(req.user.id).emit('wallet_update', {});
            global.io.to(req.user.id).emit('myitems_update', {});
            global.io.to('global').emit('item_status_changed', { id: listing._id, status: 'borrowed' });
        }

        res.json({ success: true, message: agreedPoints !== originalPoints ? `Approved at negotiated price! ${agreedPoints} pts transferred to your wallet (borrower refunded ${originalPoints - agreedPoints} pts).` : `Approved! ${agreedPoints} pts transferred to your wallet.` });
    } catch (err) {
        logger.error('Approve borrow error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Lender or Borrower: mark item as returned ────────────────────────────────
const returnItem = async (req, res) => {
    try {
        const listing = await ItemListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });

        const isLender   = listing.lender.toString()          === req.user.id;
        const isBorrower = listing.currentBorrower?.toString() === req.user.id;
        if (!isLender && !isBorrower)
            return res.status(403).json({ success: false, message: 'Not authorized' });

        const request = listing.borrowRequests.find(r => r.status === 'approved');
        if (request) { request.status = 'returned'; request.returnedAt = new Date(); }

        listing.status          = 'available';
        listing.isAvailable     = true;
        listing.currentBorrower = null;

        if (request) {
            const borrowerId = request.borrower?.toString();
            await User.findByIdAndUpdate(borrowerId, { $inc: { timelyRepayments: 1 } });
        }

        await listing.save();

        if (request && isBorrower) {
            await createNotification({
                user:         listing.lender,
                type:         'item_returned',
                title:        '📬 Item Returned',
                message:      `Your item "${listing.itemName}" has been marked as returned. It's now available again.`,
                relatedId:    listing._id,
                relatedModel: 'ItemListing'
            });
            if (global.io) global.io.to(listing.lender.toString()).emit('notification_update', {});
        }
        if (request && isLender) {
            const borrowerId = request.borrower?.toString();
            await createNotification({
                user:         borrowerId,
                type:         'item_returned',
                title:        '✅ Return Confirmed',
                message:      `The lender confirmed return of "${listing.itemName}". Thank you!`,
                relatedId:    listing._id,
                relatedModel: 'ItemListing'
            });
            if (global.io) global.io.to(borrowerId).emit('notification_update', {});
        }

        // Real-time updates
        if (global.io) {
            global.io.to(req.user.id).emit('myitems_update', {});
            global.io.to(listing.lender.toString()).emit('myitems_update', {});
            global.io.to('global').emit('item_status_changed', { id: listing._id, status: 'available' });
        }

        res.json({ success: true, message: 'Item marked as returned. Listing is available again.' });
    } catch (err) {
        logger.error('Return item error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Lender: reject a borrow request ─────────────────────────────────────────
const rejectBorrow = async (req, res) => {
    try {
        const listing = await ItemListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
        if (listing.lender.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: 'Only the lender can reject' });

        const request = listing.borrowRequests.id(req.params.reqId);
        if (!request || request.status !== 'pending')
            return res.status(400).json({ success: false, message: 'Request not found or already handled' });

        const totalPoints = request.totalPoints || listing.pointsPerDay;
        const borrowerId  = request.borrower?.toString();

        await Wallet.findOneAndUpdate(
            { user: borrowerId },
            { $inc: { balance: totalPoints, lockedBalance: -totalPoints, totalSpent: -totalPoints },
              $set:  { lastTransactionAt: new Date() } }
        );

        request.status          = 'rejected';
        request.rejectedAt      = new Date();
        request.rejectionReason = req.body.reason || 'Declined by lender';
        await listing.save();

        await Transaction.findOneAndUpdate(
            { fromUser: borrowerId, listingId: listing._id, status: 'pending' },
            { status: 'cancelled', description: `Refund: borrow request rejected for "${listing.itemName}"` }
        );

        await createNotification({
            user:         borrowerId,
            type:         'borrow_rejected',
            title:        '❌ Borrow Request Declined',
            message:      `Your request for "${listing.itemName}" was declined. ${totalPoints} pts have been refunded to your wallet.`,
            relatedId:    listing._id,
            relatedModel: 'ItemListing'
        });

        if (global.io) {
            global.io.to(borrowerId).emit('notification_update', {});
            global.io.to(borrowerId).emit('wallet_update', {});
            global.io.to(borrowerId).emit('myitems_update', {});
            global.io.to(req.user.id).emit('myitems_update', {});
        }

        res.json({ success: true, message: 'Request rejected and points refunded.' });
    } catch (err) {
        logger.error('Reject borrow error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Lender: unlist / edit listing ───────────────────────────────────────────
const unlistItem = async (req, res) => {
    try {
        const listing = await ItemListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ success: false, message: 'Not found' });
        if (listing.lender.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: 'Not authorized' });
        if (listing.status === 'borrowed')
            return res.status(400).json({ success: false, message: 'Cannot unlist while item is borrowed' });

        listing.status      = 'unlisted';
        listing.isAvailable = false;
        await listing.save();

        emitItemUpdate('item_status_changed', { id: listing._id, status: 'unlisted' });

        res.json({ success: true, message: 'Item unlisted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Lender: relist a previously unlisted item ────────────────────────────────
const relistItem = async (req, res) => {
    try {
        const listing = await ItemListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ success: false, message: 'Not found' });
        if (listing.lender.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: 'Not authorized' });
        if (listing.status !== 'unlisted')
            return res.status(400).json({ success: false, message: 'Item is not unlisted' });

        listing.status      = 'available';
        listing.isAvailable = true;
        await listing.save();

        const populated = await ItemListing.findById(listing._id).populate('lender', 'name email tier');
        emitItemUpdate('item_created', populated);

        res.json({ success: true, message: 'Item relisted and available again.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { createListing, getListings, getListing, requestBorrow, approveBorrow, rejectBorrow, returnItem, unlistItem, relistItem };
