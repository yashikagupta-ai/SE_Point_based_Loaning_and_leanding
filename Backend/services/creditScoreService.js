// services/creditScoreService.js
const User = require('../models/User');
const ItemListing = require('../models/ItemListing');
const Settings = require('../models/Settings');

class CreditScoreService {
    static async calculateAndSaveScore(userId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        // Count real borrow transactions from item listings
        const lentItems = await ItemListing.find({ lender: userId });
        const allRequests = lentItems.flatMap(item => item.borrowRequests || []);
        const approvedRequests = allRequests.filter(r => r.status === 'approved' || r.status === 'returned');
        const returnedRequests = allRequests.filter(r => r.status === 'returned');

        const borrowedItems = await ItemListing.find({ 'borrowRequests.borrower': userId });
        const myRequests = borrowedItems.flatMap(item =>
            (item.borrowRequests || []).filter(r => r.borrower?.toString() === userId.toString())
        );
        const myReturned = myRequests.filter(r => r.status === 'returned');

        const factors = {
            timelyRepayments: this.evaluateTimelyRepayments(user, myReturned.length),
            loanPerformance:  this.evaluateLoanPerformance(myRequests.length),
            lendingReliability: this.evaluateLendingReliability(approvedRequests.length),
            accountAge:       this.evaluateAccountAge(user),
            transactionVolume: this.evaluateTransactionVolume(myRequests.length + approvedRequests.length)
        };

        let score = 300; // base
        score += factors.timelyRepayments;
        score += factors.loanPerformance;
        score += factors.lendingReliability;
        score += factors.accountAge;
        score += factors.transactionVolume;

        // Late penalty — configurable by admin (default 10 pts per late return, max deduction 50)
        if (user.lateRepayments > 0) {
            const penaltyPerReturn = await Settings.get('late_penalty_per_return', 10);
            score -= Math.min(50, user.lateRepayments * penaltyPerReturn);
        }

        const finalScore = Math.min(850, Math.max(300, Math.round(score)));

        // Save updated score and tier
        const tier = finalScore >= 750 ? 'Gold' : finalScore >= 600 ? 'Silver' : 'Bronze';
        await User.findByIdAndUpdate(userId, { creditScore: finalScore, tier });

        return { score: finalScore, factors, tier };
    }

    static evaluateTimelyRepayments(user, returnedCount) {
        const total = returnedCount + (user.lateRepayments || 0);
        if (total === 0) return 100; // New user gets full timely repayment score
        const ratio = returnedCount / total;
        if (ratio >= 0.95) return 100;
        if (ratio >= 0.85) return 70;
        if (ratio >= 0.70) return 40;
        return 10;
    }

    static evaluateLoanPerformance(borrowCount) {
        if (borrowCount === 0) return 0;
        return Math.min(100, borrowCount * 20);
    }

    static evaluateLendingReliability(lentCount) {
        if (lentCount === 0) return 0;
        return Math.min(100, lentCount * 25);
    }

    static evaluateAccountAge(user) {
        const accountAge = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return Math.min(100, Math.floor(accountAge / 7) * 10);
    }

    static evaluateTransactionVolume(totalTx) {
        return Math.min(100, totalTx * 10);
    }

    static getBorrowingLimit(creditScore) {
        if (creditScore >= 750) return 5000;
        if (creditScore >= 600) return 3000;
        if (creditScore >= 500) return 1000;
        return 500;
    }

    static getInterestRate(creditScore) {
        if (creditScore >= 750) return 5;
        if (creditScore >= 600) return 8;
        if (creditScore >= 500) return 12;
        return 18;
    }
}

module.exports = CreditScoreService;
