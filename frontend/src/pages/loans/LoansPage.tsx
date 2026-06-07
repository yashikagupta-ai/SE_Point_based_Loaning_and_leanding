import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { Plus, Package, Tag, Clock, Star, X, RefreshCw, ImagePlus, MessageCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { itemApi, chatApi } from '@/services/api';
import type { RootState } from '@/store';
import { cn, formatDate } from '@/utils/helpers';
import { getSocket } from '@/services/socket';

const CATEGORIES = ['all', 'textbooks', 'lab equipment', 'sports gear', 'electronics', 'stationery', 'furniture', 'clothing', 'other'];
const CONDITIONS  = ['new', 'like new', 'good', 'fair'];

const categoryColors: Record<string, string> = {
  textbooks:       'bg-blue-100 text-blue-700',
  'lab equipment': 'bg-purple-100 text-purple-700',
  'sports gear':   'bg-green-100 text-green-700',
  electronics:     'bg-yellow-100 text-yellow-700',
  stationery:      'bg-pink-100 text-pink-700',
  furniture:       'bg-orange-100 text-orange-700',
  clothing:        'bg-teal-100 text-teal-700',
  other:           'bg-gray-100 text-gray-600',
};

const API_BASE = (() => {
  const url = (import.meta as any).env?.VITE_API_URL || '';
  return url.replace(/\/api\/?$/, '');
})();

const imgUrl = (src: string): string => {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  const uploadsIdx = src.indexOf('/uploads/');
  const relativePath = uploadsIdx !== -1 ? src.slice(uploadsIdx) : src;
  return `${API_BASE}${relativePath}`;
};

// Nice image card component with proper aspect ratio + contain
const ItemImage: React.FC<{ src?: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className={cn('bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center', className)}>
        <Package className="w-12 h-12 text-gray-300" />
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

const LoansPage: React.FC = () => {
  const { user } = useSelector((s: RootState) => s.auth);
  const currentUserId = user?.id ?? (user as any)?._id ?? '';
  const [listings,    setListings]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [category,    setCategory]    = useState('all');
  const [showPost,    setShowPost]    = useState(false);
  const [showBorrow,  setShowBorrow]  = useState(false);
  const [selected,    setSelected]    = useState<any | null>(null);
  const [posting,     setPosting]     = useState(false);
  const [borrowing,   setBorrowing]   = useState(false);
  const [negotiating, setNegotiating] = useState(false);
  const [toast,       setToast]       = useState('');
  const [itemImage,   setItemImage]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [postForm, setPostForm] = useState({
    itemName: '', description: '', category: 'other',
    pointsPerDay: '', maxDuration: '30', condition: 'good'
  });
  const [borrowForm, setBorrowForm] = useState({ duration: '1', message: '' });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(() => {
    setLoading(true);
    itemApi.getListings({ category: category === 'all' ? undefined : category })
      .then(r => setListings(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => { load(); }, [load]);

  // Real-time: listen for new items & status changes
  useEffect(() => {
    const socket = getSocket();
    if (currentUserId) socket.emit('register', currentUserId);

    const onItemCreated = (newItem: any) => {
      // Only add if it belongs to the current filter and not own item
      if (newItem.lender?._id === currentUserId || newItem.lender === currentUserId) return;
      if (category !== 'all' && newItem.category !== category) return;
      setListings(prev => {
        if (prev.find(l => l._id === newItem._id)) return prev;
        return [newItem, ...prev];
      });
    };

    const onStatusChanged = ({ id, status }: { id: string; status: string }) => {
      setListings(prev => prev.map(l =>
        l._id === id ? { ...l, status } : l
      ).filter(l => {
        // Remove items that are no longer available from the market view
        if (status === 'unlisted' && l._id === id) return false;
        return true;
      }));
    };

    socket.on('item_created', onItemCreated);
    socket.on('item_status_changed', onStatusChanged);

    return () => {
      socket.off('item_created', onItemCreated);
      socket.off('item_status_changed', onStatusChanged);
    };
  }, [currentUserId, category]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setItemImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      await itemApi.createListing({
        ...postForm,
        pointsPerDay: Number(postForm.pointsPerDay),
        maxDuration:  Number(postForm.maxDuration),
        image: itemImage,
      });
      showToast('Item listed successfully!');
      setShowPost(false);
      setPostForm({ itemName: '', description: '', category: 'other', pointsPerDay: '', maxDuration: '30', condition: 'good' });
      setItemImage(null);
      setImagePreview(null);
      load();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to post item');
    } finally { setPosting(false); }
  };

  const handleBorrowRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBorrowing(true);
    try {
      const days = Number(borrowForm.duration);
      await itemApi.requestBorrow(selected._id, { duration: days, message: borrowForm.message });
      const cost = selected.pointsPerDay * days;
      showToast(`Borrow request sent! ${cost} pts reserved until the owner decides.`);
      setShowBorrow(false);
      setSelected(null);
      setBorrowForm({ duration: '1', message: '' });
      load();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to send request');
    } finally { setBorrowing(false); }
  };

  const handleNegotiate = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.isKYCVerified) {
      showToast('KYC verification required. Please verify your student ID in Profile.');
      return;
    }
    if (item.lender?._id === user?.id || item.lender?.toString() === user?.id) {
      showToast("That's your own item!");
      return;
    }
    setNegotiating(true);
    try {
      await chatApi.sendRequest(
        item.lender?._id || item.lender,
        `Hi, I'm interested in negotiating for "${item.itemName}".`,
        item.itemName
      );
      showToast(`Chat request sent to ${item.lender?.name || 'owner'} about "${item.itemName}"!`);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to send chat request';
      if (msg.includes('active') || msg.includes('pending')) {
        showToast(`You already have a chat open with ${item.lender?.name || 'this owner'}. Check Messages.`);
      } else {
        showToast(msg);
      }
    } finally { setNegotiating(false); }
  };

  const totalCost = selected
    ? selected.pointsPerDay * Math.max(1, Number(borrowForm.duration) || 1)
    : 0;

  return (
    <Layout>
      <div className="max-w-6xl space-y-6">
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="fixed top-20 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm shadow-lg">
            {toast}
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Item Market</h1>
            <p className="text-gray-500 text-sm mt-1">Browse items available to borrow, or post your own to lend</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={() => setShowPost(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#5B6CFF] text-white rounded-xl text-sm font-medium hover:bg-[#4a5be0] transition-colors">
              <Plus className="w-4 h-4" /> Post an Item
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={cn('px-3 py-1.5 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-colors',
                category === cat
                  ? 'bg-[#5B6CFF] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#5B6CFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 border border-gray-100 text-center">
            <Package className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No items listed yet</p>
            <p className="text-gray-400 text-sm mt-1">Be the first to post something!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(item => (
              <motion.div key={item._id} whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col transition-all">

                <div className="cursor-pointer" onClick={() => {
                    if (!user?.isKYCVerified) {
                      showToast('KYC verification required before borrowing. Verify your student ID in Profile.');
                      return;
                    }
                    setSelected(item); setShowBorrow(true);
                  }}>
                  {/* FIX 2: Nice image display with object-contain */}
                  <ItemImage src={item.images?.[0]} alt={item.itemName} className="w-full h-44" />

                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{item.itemName}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{item.lender?.name}</p>
                      </div>
                      <span className={cn('text-xs font-semibold px-2 py-1 rounded-full capitalize flex-shrink-0',
                        categoryColors[item.category] || 'bg-gray-100 text-gray-600')}>
                        {item.category}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1 text-[#5B6CFF] font-bold">
                        <Tag className="w-3.5 h-3.5" />
                        {item.pointsPerDay} pts/day
                      </div>
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        up to {item.maxDuration}d
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 capitalize">
                        <Star className="w-3.5 h-3.5" />
                        {item.condition}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                      <span className={cn('text-xs font-semibold px-2 py-1 rounded-full',
                        item.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                        {item.status === 'available' ? '✓ Available' : 'Currently Borrowed'}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-4 flex gap-2">
                  <button
                    onClick={() => {
                      if (!user?.isKYCVerified) { showToast('KYC required. Verify in Profile.'); return; }
                      setSelected(item); setShowBorrow(true);
                    }}
                    disabled={item.status !== 'available'}
                    className="flex-1 h-9 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-colors">
                    Borrow
                  </button>
                  <button
                    onClick={(e) => handleNegotiate(item, e)}
                    disabled={negotiating}
                    className="flex items-center gap-1.5 px-3 h-9 border border-[#5B6CFF] text-[#5B6CFF] hover:bg-[#5B6CFF]/5 disabled:opacity-40 rounded-xl text-xs font-semibold transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" /> Negotiate
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Post item modal */}
        <AnimatePresence>
          {showPost && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Post an Item</h2>
                    <p className="text-sm text-gray-400 mt-1">List something you own and want to lend out</p>
                  </div>
                  <button type="button" onClick={() => setShowPost(false)} className="p-1 rounded-lg hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {!user?.isKYCVerified && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-5 text-sm text-yellow-700">
                    ⚠️ KYC verification required before posting. Go to Profile → verify your student ID.
                  </div>
                )}

                <form onSubmit={handlePost} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Item Photo (optional)</label>
                    <input ref={imageInputRef} type="file" accept=".jpg,.jpeg,.png,.webp"
                      className="hidden" onChange={handleImageChange} />
                    {imagePreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        <img src={imagePreview} alt="preview" className="w-full h-48 object-contain" />
                        <button type="button"
                          onClick={() => { setItemImage(null); setImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                          className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => imageInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-5 hover:border-[#5B6CFF] transition-colors text-gray-400 hover:text-[#5B6CFF]">
                        <ImagePlus className="w-6 h-6" />
                        <span className="text-sm">Click to upload a photo</span>
                        <span className="text-xs">JPG, PNG, WebP · max 5 MB</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Item Name *</label>
                    <input type="text" required value={postForm.itemName}
                      onChange={e => setPostForm(f => ({ ...f, itemName: e.target.value }))}
                      placeholder="e.g. Canon EOS M50 Camera"
                      className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Description *</label>
                    <textarea required value={postForm.description}
                      onChange={e => setPostForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Describe the item, what it's for, any usage notes…"
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm resize-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
                      <select value={postForm.category} onChange={e => setPostForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full px-3 h-12 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 capitalize">
                        {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Condition</label>
                      <select value={postForm.condition} onChange={e => setPostForm(f => ({ ...f, condition: e.target.value }))}
                        className="w-full px-3 h-12 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 capitalize">
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Points / Day *</label>
                      <input type="number" required min="1" max="1000" value={postForm.pointsPerDay}
                        onChange={e => setPostForm(f => ({ ...f, pointsPerDay: e.target.value }))}
                        placeholder="e.g. 50"
                        className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Max Days</label>
                      <input type="number" min="1" max="365" value={postForm.maxDuration}
                        onChange={e => setPostForm(f => ({ ...f, maxDuration: e.target.value }))}
                        className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm" />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowPost(false)}
                      className="flex-1 h-12 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm">
                      Cancel
                    </button>
                    <button type="submit" disabled={posting || !user?.isKYCVerified}
                      className="flex-1 h-12 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center">
                      {posting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Post Item'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Borrow modal */}
        <AnimatePresence>
          {showBorrow && selected && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

                {/* FIX 2: Nice image in modal */}
                <ItemImage src={selected.images?.[0]} alt={selected.itemName} className="w-full h-48" />

                <div className="p-8">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selected.itemName}</h2>
                      <p className="text-sm text-gray-400 mt-0.5">Listed by {selected.lender?.name}</p>
                    </div>
                    <button type="button" onClick={() => { setShowBorrow(false); setSelected(null); }}
                      className="p-1 rounded-lg hover:bg-gray-100">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="bg-gradient-to-br from-[#5B6CFF]/5 to-[#3FAF7D]/5 rounded-2xl p-4 mb-5 border border-gray-100">
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div><p className="text-gray-400 text-xs">Price</p><p className="font-bold text-gray-900">{selected.pointsPerDay} pts/day</p></div>
                      <div><p className="text-gray-400 text-xs">Max</p><p className="font-bold text-gray-900">{selected.maxDuration} days</p></div>
                      <div><p className="text-gray-400 text-xs">Condition</p><p className="font-bold text-gray-900 capitalize">{selected.condition}</p></div>
                    </div>
                  </div>

                  {selected.status !== 'available' ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center text-orange-700 text-sm">
                      This item is currently borrowed and not available.
                    </div>
                  ) : (
                    <form onSubmit={handleBorrowRequest} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Duration (days) — max {selected.maxDuration}
                        </label>
                        <input type="number" required min="1" max={selected.maxDuration}
                          value={borrowForm.duration}
                          onChange={e => setBorrowForm(f => ({ ...f, duration: e.target.value }))}
                          className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Message to lender (optional)</label>
                        <input type="text" value={borrowForm.message}
                          onChange={e => setBorrowForm(f => ({ ...f, message: e.target.value }))}
                          placeholder="Why you need it, when you'll return it…"
                          className="w-full px-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm" />
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Days requested</span><span className="font-semibold">{Math.max(1, Number(borrowForm.duration) || 1)}</span></div>
                        <div className="flex justify-between mt-1"><span className="text-gray-600">Rate</span><span className="font-semibold">{selected.pointsPerDay} pts/day</span></div>
                        <div className="flex justify-between mt-1 pt-1 border-t border-blue-200">
                          <span className="font-semibold text-gray-700">Total cost</span>
                          <span className="font-bold text-[#5B6CFF]">{totalCost} pts</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Points are reserved until the owner approves or declines your request.</p>
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setShowBorrow(false); setSelected(null); }}
                          className="flex-1 h-12 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm">Cancel</button>
                        <button type="submit" disabled={borrowing}
                          className="flex-1 h-12 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center">
                          {borrowing
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : `Borrow — ${totalCost} pts`}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default LoansPage;
