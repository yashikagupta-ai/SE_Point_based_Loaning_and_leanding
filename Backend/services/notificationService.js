// services/notificationService.js
const nodemailer = require('nodemailer');
const User = require('../models/User');
const logger = require('../utils/logger');

class NotificationService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    
    // Send email notification
    async sendEmail(to, subject, html) {
        try {
            const mailOptions = {
                from: `"Points Lending System" <${process.env.EMAIL_FROM}>`,
                to,
                subject,
                html
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`Email sent: ${info.messageId}`);
            return info;
        } catch (error) {
            logger.error('Email sending failed:', error);
            throw error;
        }
    }
    
    // Loan approval notification
    async sendLoanApproved(borrowerId, loanDetails) {
        const borrower = await User.findById(borrowerId);
        if (!borrower) return;
        
        const subject = 'Your Loan Request Has Been Approved!';
        const html = `
            <h2>Loan Approved</h2>
            <p>Dear ${borrower.name},</p>
            <p>Your loan request has been approved!</p>
            <ul>
                <li>Amount: ${loanDetails.amount} points</li>
                <li>Interest Rate: ${loanDetails.interestRate}%</li>
                <li>Due Date: ${new Date(loanDetails.dueDate).toLocaleDateString()}</li>
            </ul>
            <p>The points have been credited to your wallet.</p>
            <p>Thank you for using our platform!</p>
        `;
        
        await this.sendEmail(borrower.email, subject, html);
    }
    
    // Due date reminder
    async sendDueDateReminder(borrowerId, loanDetails) {
        const borrower = await User.findById(borrowerId);
        if (!borrower) return;
        
        const daysLeft = Math.ceil((loanDetails.dueDate - Date.now()) / (1000 * 60 * 60 * 24));
        
        const subject = 'Loan Repayment Reminder';
        const html = `
            <h2>Repayment Reminder</h2>
            <p>Dear ${borrower.name},</p>
            <p>Your loan repayment is due in ${daysLeft} days.</p>
            <ul>
                <li>Outstanding Amount: ${loanDetails.outstanding} points</li>
                <li>Due Date: ${new Date(loanDetails.dueDate).toLocaleDateString()}</li>
            </ul>
            <p>Please ensure timely repayment to maintain your credit score.</p>
        `;
        
        await this.sendEmail(borrower.email, subject, html);
    }
    
    // Late payment warning
    async sendLatePaymentWarning(borrowerId, loanDetails) {
        const borrower = await User.findById(borrowerId);
        if (!borrower) return;
        
        const subject = 'URGENT: Late Payment Warning';
        const html = `
            <h2>Late Payment Warning</h2>
            <p>Dear ${borrower.name},</p>
            <p>Your loan payment is now overdue.</p>
            <ul>
                <li>Overdue Amount: ${loanDetails.outstanding} points</li>
                <li>Original Due Date: ${new Date(loanDetails.dueDate).toLocaleDateString()}</li>
                <li>Late Penalty Applied: ${loanDetails.latePenaltyAmount} points</li>
            </ul>
            <p>Please make the payment immediately to avoid further penalties and credit score impact.</p>
        `;
        
        await this.sendEmail(borrower.email, subject, html);
    }
    
    // Security alert for multiple login attempts
    async sendSecurityAlert(email, ipAddress) {
        const subject = 'Security Alert: Multiple Failed Login Attempts';
        const html = `
            <h2>Security Alert</h2>
            <p>We detected multiple failed login attempts on your account.</p>
            <ul>
                <li>Time: ${new Date().toLocaleString()}</li>
                <li>IP Address: ${ipAddress}</li>
            </ul>
            <p>If this wasn't you, please change your password immediately.</p>
        `;
        
        await this.sendEmail(email, subject, html);
    }
}

module.exports = new NotificationService();