// cron/reminderJobs.js
const cron = require('node-cron');
const Loan = require('../models/Loan');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

class ReminderJobs {
    // Initialize all cron jobs
    static init() {
        // Check for due dates every day at 8 AM
        cron.schedule('0 8 * * *', () => {
            this.checkDueDates();
        });
        
        // Check for overdue loans every day at 9 AM and 6 PM
        cron.schedule('0 9,18 * * *', () => {
            this.checkOverdueLoans();
        });
        
        // Send weekly summary every Monday at 10 AM
        cron.schedule('0 10 * * 1', () => {
            this.sendWeeklySummary();
        });
        
        logger.info('Cron jobs initialized');
    }
    
    // Check for upcoming due dates and send reminders
    static async checkDueDates() {
        try {
            const now = new Date();
            const threeDaysFromNow = new Date(now);
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
            
            const oneDayFromNow = new Date(now);
            oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
            
            // Find loans due in 3 days
            const loansDueIn3Days = await Loan.find({
                status: 'active',
                dueDate: {
                    $gte: now,
                    $lte: threeDaysFromNow
                }
            }).populate('borrower');
            
            for (const loan of loansDueIn3Days) {
                await notificationService.sendDueDateReminder(
                    loan.borrower._id,
                    {
                        outstanding: loan.outstanding,
                        dueDate: loan.dueDate
                    }
                );
                logger.info(`Reminder sent for loan ${loan._id}`);
            }
            
            // Find loans due tomorrow
            const loansDueTomorrow = await Loan.find({
                status: 'active',
                dueDate: {
                    $gte: now,
                    $lte: oneDayFromNow
                }
            }).populate('borrower');
            
            for (const loan of loansDueTomorrow) {
                await notificationService.sendDueDateReminder(
                    loan.borrower._id,
                    {
                        outstanding: loan.outstanding,
                        dueDate: loan.dueDate
                    }
                );
                logger.info(`Urgent reminder sent for loan ${loan._id}`);
            }
            
        } catch (error) {
            logger.error('Error checking due dates:', error);
        }
    }
    
    // Check for overdue loans and apply penalties
    static async checkOverdueLoans() {
        try {
            const overdueLoans = await Loan.find({
                status: 'active',
                dueDate: { $lt: new Date() }
            }).populate('borrower');
            
            for (const loan of overdueLoans) {
                // Mark as late
                loan.isLate = true;
                
                // Apply late penalty if not already applied
                if (!loan.latePenaltyApplied) {
                    loan.applyLatePenalty();
                    
                    // Send warning notification
                    await notificationService.sendLatePaymentWarning(
                        loan.borrower._id,
                        {
                            outstanding: loan.outstanding,
                            dueDate: loan.dueDate,
                            latePenaltyAmount: loan.latePenaltyAmount
                        }
                    );
                }
                
                await loan.save();
                
                // Update borrower's credit score (will be handled by credit score service)
                logger.warn(`Loan ${loan._id} is overdue`);
            }
            
        } catch (error) {
            logger.error('Error checking overdue loans:', error);
        }
    }
    
    // Send weekly summary to users
    static async sendWeeklySummary() {
        try {
            const users = await User.find({ isActive: true });
            
            for (const user of users) {
                const activeLoans = await Loan.countDocuments({
                    borrower: user._id,
                    status: 'active'
                });
                
                const repaidLoans = await Loan.countDocuments({
                    borrower: user._id,
                    status: 'repaid'
                });
                
                // Send summary email
                const subject = 'Your Weekly Points Lending Summary';
                const html = `
                    <h2>Weekly Activity Summary</h2>
                    <p>Dear ${user.name},</p>
                    <ul>
                        <li>Active Loans: ${activeLoans}</li>
                        <li>Loans Repaid: ${repaidLoans}</li>
                        <li>Current Credit Score: ${user.creditScore}</li>
                        <li>Tier: ${user.tier}</li>
                    </ul>
                    <p>Thank you for being part of our community!</p>
                `;
                
                await notificationService.sendEmail(user.email, subject, html);
            }
            
            logger.info(`Weekly summaries sent to ${users.length} users`);
            
        } catch (error) {
            logger.error('Error sending weekly summaries:', error);
        }
    }
}

module.exports = ReminderJobs;