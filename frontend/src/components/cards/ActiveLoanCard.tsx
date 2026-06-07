import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import type { Loan } from '@/types';
import { cn, formatDate } from '@/utils/helpers';

interface Props {
  loan: Loan;
  currentUserId: string;
  onRepay?: (loan: Loan) => void;
}

const ActiveLoanCard: React.FC<Props> = ({ loan, currentUserId, onRepay }) => {
  const isBorrower  = loan.borrower._id === currentUserId;
  const outstanding = loan.currentOutstanding ?? (loan.totalRepayable - loan.amountPaid);
  const progress    = Math.min((loan.amountPaid / loan.totalRepayable) * 100, 100);

  return (
    <motion.div whileHover={{ y: -1, boxShadow: '0 6px 24px rgba(0,0,0,0.07)' }}
      className={cn('bg-white rounded-2xl p-5 border transition-all',
        loan.isOverdue ? 'border-red-200' : 'border-gray-100')}>

      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full',
              isBorrower ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700')}>
              {isBorrower ? '📦 Borrowing' : '💰 Lending'}
            </span>
            {loan.isOverdue && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Overdue
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {isBorrower
              ? <>Points from <span className="font-semibold text-gray-700">{loan.lender.name}</span></>
              : <>Points to <span className="font-semibold text-gray-700">{loan.borrower.name}</span></>}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold text-gray-900">{loan.principal} pts</p>
          <p className="text-xs text-gray-400">borrowed</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Returned: {loan.amountPaid} pts</span>
          <span>Still owed: {Math.round(outstanding)} pts</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#5B6CFF] to-[#3FAF7D] rounded-full transition-all"
            style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1">{progress.toFixed(0)}% returned</p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          Due: {formatDate(loan.dueDate)}
          {loan.daysUntilDue !== undefined && (
            <span className={cn('ml-1 font-medium',
              loan.daysUntilDue < 0 ? 'text-red-500' :
              loan.daysUntilDue <= 3 ? 'text-orange-500' : 'text-gray-500')}>
              ({loan.daysUntilDue < 0
                ? `${Math.abs(loan.daysUntilDue)}d overdue`
                : `${loan.daysUntilDue}d left`})
            </span>
          )}
        </div>
        {isBorrower && onRepay ? (
          <button onClick={() => onRepay(loan)}
            className="text-xs text-white bg-[#5B6CFF] hover:bg-[#4a5be0] px-4 py-1.5 rounded-lg font-medium transition-colors">
            Return Points
          </button>
        ) : !isBorrower ? (
          <div className="flex items-center gap-1 text-xs text-[#3FAF7D] font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Earning back {loan.interestRate}%
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};

export default ActiveLoanCard;
