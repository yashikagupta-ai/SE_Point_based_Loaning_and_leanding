// services/fraudDetectionService.js
const User = require('../models/User');
const Loan = require('../models/Loan');
const LoanRequest = require('../models/LoanRequest');
const logger = require('../utils/logger');

class FraudDetectionService {
    // Analyze user behavior for potential fraud
    static async analyzeUser(userId) {
        const user = await User.findById(userId);
        if (!user) return null;
        
        const flags = [];
        let riskScore = 0;
        
        // Check for rapid succession loan requests
        const recentRequests = await LoanRequest.find({
            borrower: userId,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).count();
        
        if (recentRequests > 5) {
            flags.push('Rapid loan requests');
            riskScore += 30;
        }
        
        // Check for unusually high loan amounts relative to credit score
        const highAmountRequests = await LoanRequest.find({
            borrower: userId,
            amount: { $gt: user.creditScore * 2 }
        }).count();
        
        if (highAmountRequests > 0) {
            flags.push('High amount requests relative to credit score');
            riskScore += 20;
        }
        
        // Check for multiple accounts from same IP (would need IP tracking)
        // This would require additional data collection
        
        // Check for default history
        const defaults = await Loan.countDocuments({
            borrower: userId,
            status: 'defaulted'
        });
        
        if (defaults > 2) {
            flags.push('Multiple defaults');
            riskScore += 40;
        }
        
        // Check for unusual lending patterns
        if (user.role === 'user' && user.totalLent > user.totalBorrowed * 10) {
            flags.push('Unusual lending pattern');
            riskScore += 15;
        }
        
        return {
            userId,
            riskScore,
            flags,
            riskLevel: this.getRiskLevel(riskScore)
        };
    }
    
    // Analyze transaction pattern
    static async analyzeTransaction(transaction) {
        const flags = [];
        let suspicious = false;
        
        // Check for round number fraud
        if (transaction.amount % 1000 === 0 && transaction.amount > 5000) {
            flags.push('Large round number transaction');
            suspicious = true;
        }
        
        // Check for multiple small transactions (structuring)
        // Would need to check recent transactions
        
        return {
            suspicious,
            flags
        };
    }
    
    // Get risk level based on score
    static getRiskLevel(score) {
        if (score >= 70) return 'HIGH';
        if (score >= 40) return 'MEDIUM';
        if (score >= 20) return 'LOW';
        return 'MINIMAL';
    }
    
    // Generate fraud alert
    static async generateAlert(userId, reason, severity) {
        const alert = {
            userId,
            reason,
            severity,
            timestamp: new Date(),
            status: 'active'
        };
        
        // Log the alert
        logger.warn(`Fraud Alert [${severity}]: User ${userId} - ${reason}`);
        
        // Here you would save to a FraudAlert model if you create one
        
        return alert;
    }
}

module.exports = FraudDetectionService;