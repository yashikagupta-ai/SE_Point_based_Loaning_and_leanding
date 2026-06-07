import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Send, History,
  Plus, CreditCard, CheckCircle, X, ShoppingCart,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { walletApi } from '@/services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import type { Transaction } from '@/types';
import { formatDate, cn } from '@/utils/helpers';
import { getSocket } from '@/services/socket';

// Label config — no 'escrow' word, direction determined dynamically
const typeLabel: Record<string, string> = {
  loan_created:         'Item Borrow Payment',
  loan_repayment:       'Points Returned',
  points_transfer:      'Transfer',
  transfer:             'Transfer',
  bonus:                'Bonus / Reward',
  bonus_earned:         'Bonus / Reward',
  points_purchased:     'Points Purchased',
  item_borrow_payment:  'Item Borrowed',
  item_borrow_refund:   'Borrow Refund',
  item_borrow_escrow:   'Item Borrow Payment',
};

const PACKAGES = [
  { points: 100,  price: 49,   label: '100 pts',  popular: false },
  { points: 300,  price: 129,  label: '300 pts',  popular: true  },
  { points: 600,  price: 239,  label: '600 pts',  popular: false },
  { points: 1200, price: 449,  label: '1200 pts', popular: false },
];

type PayStep = 'select' | 'card' | 'processing' | 'success';

const WalletPage: React.FC = () => {
  const { user } = useSelector((s: RootState) => s.auth);
  const currentUserId = user?.id ?? (user as any)?._id ?? '';

  const [wallet,        setWallet]        = useState<any>(null);
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showTransfer,  setShowTransfer]  = useState(false);
  const [showBuy,       setShowBuy]       = useState(false);
  const [form,          setForm]          = useState({ toUserId: '', amount: '', description: '' });
  const [sending,       setSending]       = useState(false);
  const [toast,         setToast]         = useState('');

  const [buyStep,       setBuyStep]       = useState<PayStep>('select');
  const [selectedPkg,   setSelectedPkg]   = useState<typeof PACKAGES[0] | null>(null);
  const [cardForm,      setCardForm]      = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [cardError,     setCardError]     = useState('');
  const [processing,    setProcessing]    = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const reload = () => {
    setLoading(true);
    Promise.all([
      walletApi.getWallet().then(r => {
        const payload = r.data.data;
        setWallet(payload?.wallet ?? payload);
      }),
      walletApi.getTransactions({ limit: 40 }).then(r => setTransactions(r.data.data || [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();

    // Real-time wallet updates
    const socket = getSocket();
    if (currentUserId) socket.emit('register', currentUserId);
    const handler = () => reload();
    socket.on('wallet_update', handler);
    return () => { socket.off('wallet_update', handler); };
  }, [currentUserId]);

  // Determine if a transaction is a credit (incoming) or debit (outgoing) for the current user
  const isCredit = (tx: any): boolean => {
    const fromId = tx.fromUser?._id ?? tx.fromUser;
    const toId   = tx.toUser?._id   ?? tx.toUser;

    // Points purchased: always credit for the user
    if (tx.type === 'points_purchased') return true;
    // Refund/cancelled: money comes back → credit
    if (tx.status === 'cancelled') return true;
    // If current user is the receiver → credit
    if (toId && toId.toString() === currentUserId) return true;
    // If current user is the sender → debit
    if (fromId && fromId.toString() === currentUserId) return false;
    // Fallback: check description for 'refund'
    if (tx.description?.toLowerCase().includes('refund')) return true;
    return false;
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await walletApi.transfer(form.toUserId, Number(form.amount), form.description);
      showToast('Transfer successful!');
      setShowTransfer(false);
      setForm({ toUserId: '', amount: '', description: '' });
      reload();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Transfer failed');
    } finally { setSending(false); }
  };

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v: string) =>
    v.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2');

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardError('');
    const raw = cardForm.number.replace(/\s/g, '');
    if (raw.length < 16) { setCardError('Enter a valid 16-digit card number'); return; }
    if (cardForm.expiry.length < 5) { setCardError('Enter a valid expiry (MM/YY)'); return; }
    if (cardForm.cvv.length < 3)    { setCardError('Enter a valid CVV'); return; }
    if (!cardForm.name.trim())       { setCardError('Enter the cardholder name'); return; }

    setProcessing(true);
    setBuyStep('processing');
    await new Promise(res => setTimeout(res, 2500));

    try {
      await walletApi.purchasePoints(selectedPkg!.points, selectedPkg!.price);
    } catch {}
    setProcessing(false);
    setBuyStep('success');
    reload();
  };

  const closeBuy = () => {
    setShowBuy(false);
    setBuyStep('select');
    setSelectedPkg(null);
    setCardForm({ number: '', expiry: '', cvv: '', name: '' });
    setCardError('');
    setProcessing(false);
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#5B6CFF] border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="fixed top-20 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm shadow-lg">
            {toast}
          </motion.div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
            <p className="text-gray-500 text-sm mt-1">Your points balance for borrowing and lending items</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowBuy(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#3FAF7D] text-white rounded-xl text-sm font-medium hover:bg-[#359e6e] transition-colors">
              <Plus className="w-4 h-4" /> Buy Points
            </button>
            <button onClick={() => setShowTransfer(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#5B6CFF] text-white rounded-xl text-sm font-medium hover:bg-[#4a5be0] transition-colors">
              <Send className="w-4 h-4" /> Send Points
            </button>
          </div>
        </div>

        {/* Balance card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] rounded-3xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-sm">Total Balance</p>
                <p className="text-4xl font-bold">{wallet?.balance ?? 0} <span className="text-2xl opacity-80">pts</span></p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Available', value: wallet?.availableBalance ?? (wallet?.balance ?? 0) - (wallet?.lockedBalance ?? 0) },
                { label: 'Locked',    value: wallet?.lockedBalance ?? 0 },
                { label: 'Earned',    value: wallet?.totalEarned ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/15 rounded-xl p-3">
                  <p className="text-white/70 text-xs">{label}</p>
                  <p className="font-bold text-white mt-1">{value} pts</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {transactions.length === 0 && (
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-sm text-blue-700">
            💡 You received <strong>100 points</strong> as a signup bonus. Use them to borrow items!
          </div>
        )}

        {/* Transactions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-bold text-gray-900">Point History</h2>
          </div>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx: any) => {
                const credit = isCredit(tx);
                const label  = typeLabel[tx.type] || tx.type?.replace(/_/g, ' ') || 'Transaction';
                const bgColor   = credit ? 'bg-green-100'  : 'bg-orange-100';
                const iconColor = credit ? 'text-green-600' : 'text-orange-600';
                return (
                  <motion.div key={tx._id} whileHover={{ x: 2 }}
                    className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', bgColor)}>
                      {credit
                        ? <ArrowDownLeft className={cn('w-5 h-5', iconColor)} />
                        : <ArrowUpRight  className={cn('w-5 h-5', iconColor)} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{label}</p>
                      <p className="text-xs text-gray-400 truncate">{tx.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn('font-bold', credit ? 'text-green-600' : 'text-gray-800')}>
                        {credit ? '+' : '-'}{tx.amount} pts
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.createdAt)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
              <History className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">No transactions yet</p>
            </div>
          )}
        </div>

        {/* Transfer modal */}
        <AnimatePresence>
          {showTransfer && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Send Points</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Available: <span className="font-semibold text-gray-700">{wallet?.availableBalance ?? wallet?.balance ?? 0} pts</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => setShowTransfer(false)} className="p-1 rounded-lg hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <form onSubmit={handleTransfer} className="space-y-4">
                  {[
                    { key: 'toUserId',    label: 'Recipient User ID', placeholder: "Paste their user ID", type: 'text'   },
                    { key: 'amount',      label: 'Amount (points)',    placeholder: 'e.g. 50',             type: 'number' },
                    { key: 'description', label: 'Note (optional)',    placeholder: 'e.g. for textbooks',  type: 'text'   },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
                      <input type={type} value={(form as any)[key]} required={key !== 'description'}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm" />
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowTransfer(false)}
                      className="flex-1 h-12 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={sending}
                      className="flex-1 h-12 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center transition-colors">
                      {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Send'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Buy Points modal */}
        <AnimatePresence>
          {showBuy && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">

                {buyStep === 'select' && (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Buy Points</h2>
                        <p className="text-sm text-gray-400 mt-1">Choose a points package</p>
                      </div>
                      <button type="button" onClick={closeBuy} className="p-1 rounded-lg hover:bg-gray-100">
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {PACKAGES.map(pkg => (
                        <button key={pkg.points} type="button"
                          onClick={() => setSelectedPkg(pkg)}
                          className={cn('relative p-4 rounded-2xl border-2 text-left transition-all',
                            selectedPkg?.points === pkg.points
                              ? 'border-[#5B6CFF] bg-[#5B6CFF]/5'
                              : 'border-gray-200 hover:border-gray-300')}>
                          {pkg.popular && (
                            <span className="absolute -top-2 left-3 bg-[#5B6CFF] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                              Popular
                            </span>
                          )}
                          <p className="font-bold text-gray-900 text-lg">{pkg.label}</p>
                          <p className="text-gray-500 text-sm mt-0.5">₹{pkg.price}</p>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={closeBuy}
                        className="flex-1 h-12 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors">
                        Cancel
                      </button>
                      <button type="button" disabled={!selectedPkg}
                        onClick={() => setBuyStep('card')}
                        className="flex-1 h-12 bg-[#3FAF7D] hover:bg-[#359e6e] disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">
                        Continue →
                      </button>
                    </div>
                  </>
                )}

                {buyStep === 'card' && (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
                        <p className="text-sm text-gray-400 mt-1">
                          {selectedPkg?.label} for <strong>₹{selectedPkg?.price}</strong>
                        </p>
                      </div>
                      <button type="button" onClick={closeBuy} className="p-1 rounded-lg hover:bg-gray-100">
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 mb-5 flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <p className="text-sm text-gray-600">Simulated payment — no real money is charged</p>
                    </div>
                    {cardError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
                        {cardError}
                      </div>
                    )}
                    <form onSubmit={handleCardSubmit} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Cardholder Name</label>
                        <input type="text" value={cardForm.name} required
                          onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Full name on card"
                          className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3FAF7D]/30 focus:border-[#3FAF7D] text-sm" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Card Number</label>
                        <input type="text" value={cardForm.number} required
                          onChange={e => setCardForm(f => ({ ...f, number: formatCardNumber(e.target.value) }))}
                          placeholder="1234 5678 9012 3456" maxLength={19}
                          className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3FAF7D]/30 focus:border-[#3FAF7D] text-sm font-mono tracking-wider" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">Expiry</label>
                          <input type="text" value={cardForm.expiry} required
                            onChange={e => setCardForm(f => ({ ...f, expiry: formatExpiry(e.target.value) }))}
                            placeholder="MM/YY" maxLength={5}
                            className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3FAF7D]/30 focus:border-[#3FAF7D] text-sm" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">CVV</label>
                          <input type="text" value={cardForm.cvv} required
                            onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g,'').slice(0,4) }))}
                            placeholder="•••" maxLength={4}
                            className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3FAF7D]/30 focus:border-[#3FAF7D] text-sm" />
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setBuyStep('select')}
                          className="flex-1 h-12 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors">
                          Back
                        </button>
                        <button type="submit"
                          className="flex-1 h-12 bg-[#3FAF7D] hover:bg-[#359e6e] text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                          <ShoppingCart className="w-4 h-4" />
                          Pay ₹{selectedPkg?.price}
                        </button>
                      </div>
                    </form>
                  </>
                )}

                {buyStep === 'processing' && (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 border-4 border-[#3FAF7D] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Payment…</h2>
                    <p className="text-gray-500 text-sm">Please wait while we confirm your transaction</p>
                  </div>
                )}

                {buyStep === 'success' && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                      <CheckCircle className="w-9 h-9 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
                    <p className="text-gray-500 text-sm mb-1">
                      <strong className="text-[#3FAF7D]">{selectedPkg?.points} points</strong> have been added to your wallet.
                    </p>
                    <p className="text-xs text-gray-400 mb-8">Amount charged: ₹{selectedPkg?.price} (simulated)</p>
                    <button onClick={closeBuy}
                      className="w-full h-12 bg-[#5B6CFF] hover:bg-[#4a5be0] text-white font-semibold rounded-xl text-sm transition-colors">
                      Done
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default WalletPage;
