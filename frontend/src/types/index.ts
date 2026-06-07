export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  creditScore: number;
  tier: string;
  isKYCVerified: boolean;
  isActive: boolean;
  totalBorrowed: number;
  totalLent: number;
  timelyRepayments: number;
  lateRepayments: number;
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface Wallet {
  balance: number;
  availableBalance: number;
  lockedBalance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface Transaction {
  _id: string;
  type: 'loan_created' | 'loan_repayment' | 'points_transfer' | 'transfer' | 'bonus';
  fromUser: { name: string; email: string } | string;
  toUser:   { name: string; email: string } | string;
  amount: number;
  description: string;
  createdAt: string;
}

export interface LoanRequest {
  _id: string;
  borrower: { _id: string; name: string; email: string; creditScore: number };
  amount: number;
  purpose: string;
  duration: number;
  interestRate: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  creditScoreAtRequest: number;
  createdAt: string;
  canLend?: boolean;
  riskLevel?: string;
}

export interface Loan {
  _id: string;
  borrower: { _id: string; name: string; email: string; creditScore: number };
  lender:   { _id: string; name: string; email: string; creditScore: number };
  principal: number;
  interestRate: number;
  totalRepayable: number;
  amountPaid: number;
  status: 'active' | 'repaid' | 'defaulted' | 'overdue';
  dueDate: string;
  currentOutstanding?: number;
  daysUntilDue?: number;
  isOverdue?: boolean;
  createdAt: string;
}

export interface Notification {
  _id: string;
  type: string;
  title?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: string;
}

export interface LoginCredentials { email: string; password: string; }
export interface RegisterData     { name: string; email: string; password: string; }
