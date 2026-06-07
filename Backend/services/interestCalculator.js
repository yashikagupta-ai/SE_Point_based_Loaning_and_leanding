// services/interestCalculator.js
class InterestCalculator {
    // Calculate interest for a loan
    static calculateInterest(principal, rate, duration) {
        // Simple interest calculation
        // rate is annual percentage, duration in days
        const annualRate = rate / 100;
        const interest = principal * annualRate * (duration / 365);
        return Math.round(interest * 100) / 100; // Round to 2 decimals
    }
    
    // Calculate total repayable amount
    static calculateTotalRepayable(principal, rate, duration) {
        const interest = this.calculateInterest(principal, rate, duration);
        return principal + interest;
    }
    
    // Calculate daily interest for active loans
    static calculateDailyInterest(principal, rate) {
        const annualRate = rate / 100;
        const dailyInterest = principal * annualRate / 365;
        return Math.round(dailyInterest * 100) / 100;
    }
    
    // Calculate late penalty
    static calculateLatePenalty(outstandingAmount, daysLate) {
        const penaltyRate = parseFloat(process.env.LATE_PENALTY_RATE) || 0.05;
        // 5% penalty for first day, then 1% per additional day
        const basePenalty = outstandingAmount * penaltyRate;
        const additionalPenalty = outstandingAmount * 0.01 * Math.max(0, daysLate - 1);
        return Math.round((basePenalty + additionalPenalty) * 100) / 100;
    }
    
    // Calculate interest from credit score
    static getRateFromCreditScore(creditScore) {
        if (creditScore >= 750) return 5;
        if (creditScore >= 650) return 8;
        if (creditScore >= 550) return 12;
        if (creditScore >= 450) return 18;
        return 24;
    }
    
    // Calculate ROI for lender
    static calculateROI(principal, totalRepaid) {
        if (principal === 0) return 0;
        const profit = totalRepaid - principal;
        return (profit / principal) * 100;
    }
}

module.exports = InterestCalculator;