import React from 'react';
import { motion } from 'framer-motion';
import { Clock, User, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import type { LoanRequest } from '@/types';
import { cn, formatDate, formatPoints, getRiskColor } from '@/utils/helpers';

interface LoanRequestCardProps {
  request: LoanRequest;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onView?: (id: string) => void;
  showActions?: boolean;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
};

const LoanRequestCard: React.FC<LoanRequestCardProps> = ({
  request, onApprove, onReject, onView, showActions = true
}) => {
  return (
    <motion.div
      whileHover={{ y: -1, boxShadow: '0 6px 24px rgba(0,0,0,0.07)' }}
      className="bg-white rounded-2xl p-5 border border-gray-100 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] flex items-center justify-center text-white font-bold text-sm">
            {request.borrower?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{request.borrower?.name || 'Unknown'}</p>
            <p className="text-xs text-gray-400">{request.borrower?.email}</p>
          </div>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', statusColors[request.status])}>
          {request.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-[#F8F9FA] rounded-xl p-3">
          <p className="text-xs text-gray-500">Amount</p>
          <p className="font-bold text-gray-900">{formatPoints(request.amount)} pts</p>
        </div>
        <div className="bg-[#F8F9FA] rounded-xl p-3">
          <p className="text-xs text-gray-500">Duration</p>
          <p className="font-bold text-gray-900">{request.duration} days</p>
        </div>
        <div className="bg-[#F8F9FA] rounded-xl p-3">
          <p className="text-xs text-gray-500">Interest Rate</p>
          <p className="font-bold text-[#5B6CFF]">{request.interestRate}% p.a.</p>
        </div>
        <div className="bg-[#F8F9FA] rounded-xl p-3">
          <p className="text-xs text-gray-500">Trust Score</p>
          <p className="font-bold text-gray-900">{request.borrower?.creditScore || request.creditScoreAtRequest}</p>
        </div>
      </div>

      {request.purpose && (
        <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
          <span className="font-medium text-gray-700">Purpose: </span>{request.purpose}
        </p>
      )}

      {request.riskLevel && (
        <div className="mt-2">
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', getRiskColor(request.riskLevel))}>
            {request.riskLevel} Risk
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          {formatDate(request.createdAt)}
        </div>
        <div className="flex gap-2">
          {onView && (
            <button onClick={() => onView(request._id)} className="text-xs text-[#5B6CFF] hover:underline font-medium">
              Details
            </button>
          )}
          {showActions && request.status === 'pending' && (
            <>
              {onReject && (
                <button
                  onClick={() => onReject(request._id)}
                  className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              )}
              {onApprove && request.canLend !== false && (
                <button
                  onClick={() => onApprove(request._id)}
                  className="flex items-center gap-1 text-xs text-white bg-[#5B6CFF] hover:bg-[#4a5be0] px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Lend
                </button>
              )}
              {request.canLend === false && (
                <span className="text-xs text-gray-400">Insufficient balance</span>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default LoanRequestCard;
