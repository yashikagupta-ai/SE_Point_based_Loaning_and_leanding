import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { Package, Tag, Check, X, RotateCcw, Trash2, Clock, Calendar, Coins } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { itemApi } from '@/services/api';
import type { RootState } from '@/store';
import { cn, formatDate } from '@/utils/helpers';
import { getSocket } from '@/services/socket';

const statusColors: Record<string, string> = {
  available:  'bg-green-100 text-green-700',
  borrowed:   'bg-orange-100 text-orange-700',
  unlisted:   'bg-gray-100 text-gray-500',
  pending:    'bg-yellow-100 text-yellow-700',
  approved:   'bg-green-100 text-green-700',
  rejected:   'bg-red-100 text-red-600',
  returned:   'bg-blue-100 text-blue-700',
};

type Tab = 'my-items' | 'borrowing';

const API_BASE = (import.meta as any).env?.VITE_API_URL?.replace('/api', '') || '';
const imgUrl = (src: string) => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  const idx = src.indexOf('/uploads/');
  return `${API_BASE}${idx !== -1 ? src.slice(idx) : src}`;
};

// Image component with nice contain display
const ItemImage: React.FC<{ src?: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className={cn('bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center', className)}>
        <Package className="w-14 h-14 text-gray-300" />
      </div>
    );
  }
  return (
    <div className={cn('bg-gray-50 flex items-center justify-center overflow-hidden', className)}>
      <img
        src={imgUrl(src)}
        alt={alt}
        className="w-full h-full object-contain"
        onError={() => setErrored(true)}
      />
    </div>
  );
};

const MyLoansPage: React.FC = () => {
  const { user }                  = useSelector((s: RootState) => s.auth);
  const currentUserId = user?.id ?? (user as any)?._id ?? '';
  const [tab, setTab]             = useState<Tab>('my-items');
  const [myItems, setMyItems]     = useState<any[]>([]);
  const [borrowing, setBorrowing] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      itemApi.getListings({ mine: true } as any).then(r => setMyItems(r.data.data || [])),
      itemApi.getListings({ borrowedByMe: true } as any).then(r => setBorrowing(r.data.data || [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();

    // Real-time: reload when items change
    const socket = getSocket();
    if (currentUserId) socket.emit('register', currentUserId);
    const handler = () => loadAll();
    socket.on('myitems_update', handler);
    return () => { socket.off('myitems_update', handler); };
  }, [loadAll, currentUserId]);

  const [negotiateModal, setNegotiateModal] = useState<{ itemId: string; reqId: string; originalPoints: number } | null>(null);
  const [negotiatedValue, setNegotiatedValue] = useState('');

  const openApproveModal = (itemId: string, reqId: string, originalPoints: number) => {
    setNegotiatedValue(String(originalPoints));
    setNegotiateModal({ itemId, reqId, originalPoints });
  };

  const handleApprove = async (itemId: string, reqId: string, agreedPoints?: number) => {
    try {
      await itemApi.approveBorrow(itemId, reqId, agreedPoints);
      const msg = agreedPoints !== undefined
        ? `Approved at negotiated price of ${agreedPoints} pts!`
        : 'Approved! Points transferred to your wallet.';
      showToast(msg);
      loadAll();
    } catch (err: any) { showToast(err.response?.data?.message || 'Failed'); }
  };

  const confirmNegotiatedApprove = async () => {
    if (!negotiateModal) return;
    const val = Number(negotiatedValue);
    if (!Number.isFinite(val) || val <= 0) { showToast('Enter a valid points amount'); return; }
    if (val > negotiateModal.originalPoints) { showToast(`Cannot exceed original amount of ${negotiateModal.originalPoints} pts`); return; }
    const { itemId, reqId, originalPoints } = negotiateModal;
    setNegotiateModal(null);
    await handleApprove(itemId, reqId, val < originalPoints ? val : undefined);
  };

  const handleReject = async (itemId: string, reqId: string) => {
    try {
      await itemApi.rejectBorrow(itemId, reqId);
      showToast('Request rejected and points refunded to borrower.');
      loadAll();
    } catch (err: any) { showToast(err.response?.data?.message || 'Failed'); }
  };

  const handleReturn = async (itemId: string) => {
    try {
      await itemApi.returnItem(itemId);
      showToast('Item marked as returned!');
      loadAll();
    } catch (err: any) { showToast(err.response?.data?.message || 'Failed'); }
  };

  const handleUnlist = async (itemId: string) => {
    if (!window.confirm('Unlist this item?')) return;
    try {
      await itemApi.unlist(itemId);
      showToast('Item unlisted.');
      loadAll();
    } catch (err: any) { showToast(err.response?.data?.message || 'Failed'); }
  };

  const handleRelist = async (itemId: string) => {
    try {
      await itemApi.relist(itemId);
      showToast('Item relisted and available again!');
      loadAll();
    } catch (err: any) { showToast(err.response?.data?.message || 'Failed'); }
  };

  const myApprovedRequest = (item: any) =>
    (item.borrowRequests || []).find(
      (r: any) => r.status === 'approved' &&
        (r.borrower?._id ?? r.borrower)?.toString() === currentUserId
    );

  // FIX 7: Safe borrower name — never show 'Unknown' when we can get name
  const borrowerName = (req: any) => {
    if (req?.borrower?.name) return req.borrower.name;
    if (typeof req?.borrower === 'string' && req.borrower.length > 20) return `User …${req.borrower.slice(-6)}`;
    return 'Borrower';
  };

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="fixed top-20 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm shadow-lg">
            {toast}
          </motion.div>
        )}

        <h1 className="text-2xl font-bold text-gray-900">My Items</h1>

        <div className="flex gap-2">
          {(['my-items', 'borrowing'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                tab === t ? 'bg-[#5B6CFF] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
              {t === 'my-items' ? 'My Listings' : "Items I'm Borrowing"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#5B6CFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* My Listings tab */}
            {tab === 'my-items' && (
              <div className="space-y-5">
                {myItems.length === 0 ? (
                  <div className="bg-white rounded-2xl p-14 border border-gray-100 text-center">
                    <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500">You haven't posted any items yet</p>
                    <p className="text-xs text-gray-400 mt-1">Go to Item Market → Post an Item</p>
                  </div>
                ) : myItems.map(item => {
                  const pendingRequests = (item.borrowRequests || []).filter((r: any) => r.status === 'pending');
                  const historyRequests = (item.borrowRequests || []).filter((r: any) => ['approved', 'returned'].includes(r.status));
                  return (
                    <motion.div key={item._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

                      {/* FIX 2: nice image */}
                      <ItemImage src={item.images?.[0]} alt={item.itemName} className="w-full h-48" />

                      <div className="p-5 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{item.itemName}</h3>
                            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
                              statusColors[item.status] || 'bg-gray-100 text-gray-600')}>
                              {item.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 line-clamp-1">{item.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{item.pointsPerDay} pts/day</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />max {item.maxDuration}d</span>
                            <span>Posted {formatDate(item.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {item.status === 'borrowed' && (
                            <button onClick={() => handleReturn(item._id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-xl text-xs font-medium hover:bg-blue-200 transition-colors">
                              <RotateCcw className="w-3.5 h-3.5" /> Mark Returned
                            </button>
                          )}
                          {item.status === 'unlisted' && (
                            <button onClick={() => handleRelist(item._id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-xs font-medium hover:bg-green-200 transition-colors">
                              <RotateCcw className="w-3.5 h-3.5" /> Relist
                            </button>
                          )}
                          {item.status === 'available' && (
                            <button onClick={() => handleUnlist(item._id)}
                              className="p-2 rounded-xl hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Pending borrow requests */}
                      {pendingRequests.length > 0 && (
                        <div className="border-t border-gray-50 px-5 py-4 bg-yellow-50/40">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                            Borrow Requests ({pendingRequests.length})
                          </p>
                          <div className="space-y-2">
                            {pendingRequests.map((req: any) => (
                              <div key={req._id} className="bg-white rounded-xl p-3 flex items-center gap-3 border border-gray-100">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {/* FIX 7 */}
                                  {borrowerName(req)?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {/* FIX 7: show real name */}
                                  <p className="text-sm font-semibold text-gray-900">{borrowerName(req)}</p>
                                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{req.duration} day{req.duration !== 1 ? 's' : ''}</span>
                                    <span className="flex items-center gap-1"><Coins className="w-3 h-3" />{req.totalPoints} pts total</span>
                                  </div>
                                  {req.message && <p className="text-xs text-gray-400 truncate italic mt-0.5">"{req.message}"</p>}
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <button onClick={() => handleReject(item._id, req._id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Reject">
                                    <X className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => openApproveModal(item._id, req._id, req.totalPoints)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-[#3FAF7D] text-white rounded-lg text-xs font-medium hover:bg-[#359e6e] transition-colors">
                                    <Check className="w-3.5 h-3.5" /> Approve
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Borrow history — FIX 7: show real names */}
                      {historyRequests.length > 0 && (
                        <div className="border-t border-gray-50 px-5 py-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Borrow History</p>
                          {historyRequests.map((req: any) => (
                            <div key={req._id} className="flex items-center gap-3 text-sm py-1.5">
                              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0', statusColors[req.status])}>
                                {req.status}
                              </span>
                              <span className="text-gray-600 font-medium">{borrowerName(req)}</span>
                              <span className="text-gray-400 text-xs">{req.duration}d · {req.totalPoints} pts</span>
                              <span className="text-gray-300 text-xs ml-auto">{req.approvedAt ? formatDate(req.approvedAt) : ''}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Items I'm borrowing tab */}
            {tab === 'borrowing' && (
              <div className="space-y-4">
                {borrowing.length === 0 ? (
                  <div className="bg-white rounded-2xl p-14 border border-gray-100 text-center">
                    <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500">You're not borrowing any items right now</p>
                    <p className="text-xs text-gray-400 mt-1">Browse the Item Market to find something to borrow</p>
                  </div>
                ) : borrowing.map(item => {
                  const myReq = myApprovedRequest(item);
                  return (
                    <motion.div key={item._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      {/* FIX 2: nice image */}
                      <ItemImage src={item.images?.[0]} alt={item.itemName} className="w-full h-48" />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900">{item.itemName}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">Lent by {item.lender?.name}</p>
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                          </div>
                          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0', statusColors.borrowed)}>
                            Active
                          </span>
                        </div>

                        {myReq && (
                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                              <p className="font-bold text-gray-900 text-sm">{myReq.duration} day{myReq.duration !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className="text-xs text-gray-400 mb-0.5">Points paid</p>
                              <p className="font-bold text-[#5B6CFF] text-sm">{myReq.totalPoints} pts</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className="text-xs text-gray-400 mb-0.5">Approved</p>
                              <p className="font-bold text-gray-900 text-sm">{myReq.approvedAt ? formatDate(myReq.approvedAt) : '—'}</p>
                            </div>
                          </div>
                        )}

                        <button onClick={() => handleReturn(item._id)}
                          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-colors">
                          <RotateCcw className="w-4 h-4" /> Mark as Returned
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Negotiated Approval Modal ── */}
      {negotiateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1">Approve Borrow Request</h3>
            <p className="text-sm text-gray-500 mb-5">
              You can approve at the original price or enter a lower negotiated amount.
            </p>

            <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center mb-4">
              <span className="text-xs text-gray-400 font-medium">Original requested price</span>
              <span className="font-bold text-gray-700">{negotiateModal.originalPoints} pts</span>
            </div>

            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Agreed price (pts)
            </label>
            <input
              type="number"
              min={1}
              max={negotiateModal.originalPoints}
              value={negotiatedValue}
              onChange={e => setNegotiatedValue(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3FAF7D] mb-1"
            />
            {Number(negotiatedValue) < negotiateModal.originalPoints && Number(negotiatedValue) > 0 && (
              <p className="text-xs text-[#3FAF7D] font-medium mb-4">
                Borrower will be refunded {negotiateModal.originalPoints - Number(negotiatedValue)} pts.
              </p>
            )}
            {(Number(negotiatedValue) >= negotiateModal.originalPoints || !Number(negotiatedValue)) && (
              <p className="text-xs text-gray-400 mb-4">
                Set a lower amount to approve at a negotiated price.
              </p>
            )}

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setNegotiateModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmNegotiatedApprove}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#3FAF7D] text-white text-sm font-semibold hover:bg-[#359e6e] transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
};

export default MyLoansPage;
