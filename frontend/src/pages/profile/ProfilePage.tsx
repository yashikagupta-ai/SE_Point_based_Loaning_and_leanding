import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { TrendingUp, Shield, Upload, BarChart2, CheckCircle, AlertTriangle, Copy, Check } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { userApi } from '@/services/api';
import type { RootState, AppDispatch } from '@/store';
import { updateUser } from '@/store/authSlice';
import { getCreditTierColor, cn } from '@/utils/helpers';

const FACTOR_LABELS: Record<string, string> = {
  timelyRepayments:   'Timely Returns',
  loanPerformance:    'Loan Performance',
  lendingReliability: 'Lending Reliability',
  accountAge:         'Account Age',
  transactionVolume:  'Transaction Volume',
};

const ProfilePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);

  const [profileData,   setProfileData]   = useState<any>(null);
  const [creditInfo,    setCreditInfo]    = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [editing,       setEditing]       = useState(false);
  const [editName,      setEditName]      = useState(user?.name || '');
  const [saving,        setSaving]        = useState(false);
  const [kycFile,       setKycFile]       = useState<File | null>(null);
  const [uploadingKyc,  setUploadingKyc]  = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [toast,         setToast]         = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const userId = user?.id ?? (user as any)?._id ?? '';

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      userApi.getProfile().then(r => setProfileData(r.data.data)),
      userApi.getCreditScore().then(r => {
        const d = r.data.data;
        setCreditInfo(d);
        // Sync updated score & tier into Redux so header updates
        if (d?.currentScore) dispatch(updateUser({ creditScore: d.currentScore, tier: d.tier }));
      }),
    ]).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userApi.updateProfile({ name: editName });
      dispatch(updateUser({ name: editName }));
      setEditing(false);
      showToast('Name updated!');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  const handleKyc = async () => {
    if (!kycFile) return;
    setUploadingKyc(true);
    try {
      const r = await userApi.uploadKYC(kycFile);
      const d = r.data.data;
      showToast(d?.message || 'KYC submitted!');
      setKycFile(null);
      userApi.getProfile().then(r2 => {
        const updated = r2.data.data;
        setProfileData(updated);
        dispatch(updateUser({ isKYCVerified: updated.isKYCVerified }));
      });
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Upload failed');
    } finally { setUploadingKyc(false); }
  };

  const copyId = () => {
    navigator.clipboard.writeText(userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const creditScore  = creditInfo?.currentScore ?? user?.creditScore ?? 0;
  const creditTier   = creditInfo?.tier ?? user?.tier ?? 'Bronze';
  const creditColor  = getCreditTierColor(creditScore);
  const wallet       = profileData?.wallet;
  const stats        = profileData?.stats;

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#5B6CFF] border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="fixed top-20 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm shadow-lg">
            {toast}
          </motion.div>
        )}

        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left ── */}
          <div className="space-y-4">

            {/* Identity card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                {user?.name?.[0]?.toUpperCase()}
              </div>

              {editing ? (
                <form onSubmit={handleSave} className="space-y-3">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF]" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing(false)}
                      className="flex-1 h-9 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={saving}
                      className="flex-1 h-9 bg-[#5B6CFF] text-white rounded-lg text-sm hover:bg-[#4a5be0] transition-colors flex items-center justify-center">
                      {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
                  <p className="text-sm text-gray-400 mt-1 break-all">{user?.email}</p>
                  <span className="inline-block mt-2 text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                    {creditTier} · {user?.role}
                  </span>

                  <div className="mt-4 bg-gray-50 rounded-xl p-3 text-left">
                    <p className="text-xs text-gray-400 mb-1.5">Your User ID <span className="text-gray-300">(share for messages)</span></p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-gray-600 break-all flex-1 select-all">{userId}</p>
                      <button onClick={copyId}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  <button onClick={() => { setEditing(true); setEditName(user?.name || ''); }}
                    className="mt-3 w-full h-9 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    Edit Name
                  </button>
                </>
              )}
            </div>

            {/* Wallet snapshot */}
            {wallet && (
              <div className="bg-gradient-to-br from-[#5B6CFF]/5 to-[#3FAF7D]/5 rounded-2xl p-5 border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Wallet</p>
                {[
                  { label: 'Balance',   value: `${wallet.balance ?? 0} pts`           },
                  { label: 'Available', value: `${wallet.availableBalance ?? 0} pts`  },
                  { label: 'Locked',    value: `${wallet.lockedBalance ?? 0} pts`     },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* KYC */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-[#5B6CFF]" />
                <h3 className="font-semibold text-gray-900">KYC Verification</h3>
              </div>
              <div className={cn('flex items-center gap-2 p-3 rounded-xl mb-4',
                user?.isKYCVerified ? 'bg-green-50' : 'bg-yellow-50')}>
                {user?.isKYCVerified
                  ? <><CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" /><span className="text-sm font-medium text-green-700">Verified — you can post & borrow items</span></>
                  : <><AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" /><span className="text-sm font-medium text-yellow-700">Not verified — upload your Mahindra University ID</span></>}
              </div>
              {!user?.isKYCVerified && (
                <div className="space-y-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                    <p className="font-semibold">eKYC — Automatic Verification</p>
                    <p>Upload a clear photo of your <strong>Mahindra University student ID card</strong> (front side).</p>
                    <p className="text-blue-500">• Only Mahindra University ID cards are accepted.</p>
                    <p className="text-orange-500 font-medium">⚠️ Uploading a non-MU card will be rejected.</p>
                  </div>
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#5B6CFF] transition-colors">
                    <Upload className="w-6 h-6 text-gray-300" />
                    <span className="text-sm text-gray-500 text-center">
                      {kycFile ? kycFile.name : 'Upload Mahindra University ID Card'}
                    </span>
                    <span className="text-xs text-gray-400">JPG, PNG or PDF · max 5 MB · front side</span>
                    <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf"
                      onChange={e => setKycFile(e.target.files?.[0] || null)} />
                  </label>
                  {kycFile && (
                    <button onClick={handleKyc} disabled={uploadingKyc}
                      className="w-full h-10 bg-[#5B6CFF] text-white rounded-xl text-sm font-medium hover:bg-[#4a5be0] transition-colors flex items-center justify-center gap-2">
                      {uploadingKyc
                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying…</>
                        : <><Upload className="w-4 h-4" /> Verify Student ID</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Trust Score — hidden for admins */}
            {user?.role !== 'admin' && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-5 h-5 text-[#5B6CFF]" />
                <h3 className="font-semibold text-gray-900">Trust Score</h3>
              </div>
              <div className="flex items-end gap-6 mb-4">
                <div>
                  <p className="text-5xl font-bold" style={{ color: creditColor }}>{creditScore}</p>
                  <p className="text-sm text-gray-400 mt-1">out of 850</p>
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${((creditScore - 300) / 550) * 100}%`, backgroundColor: creditColor }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>300</span><span>Poor</span><span>Fair</span><span>Good</span><span>850</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Trust Level',      value: creditTier },
                  { label: 'Total Items Lent', value: `${profileData?.totalLent ?? user?.totalLent ?? 0} pts earned` },
                  { label: 'On-time Returns',  value: creditInfo?.history?.timelyRepayments ?? profileData?.timelyRepayments ?? 0 },
                  { label: 'Late Returns',     value: creditInfo?.history?.lateRepayments   ?? profileData?.lateRepayments   ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="font-bold text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              {creditInfo?.factors && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Score Factors</p>
                  <div className="space-y-2.5">
                    {Object.entries(creditInfo.factors).map(([key, val]: any) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-gray-600 w-40 flex-shrink-0">
                          {FACTOR_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#5B6CFF] rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(val, 100)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-8 text-right">{val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Admin info card — shown instead of trust score / activity */}
            {user?.role === 'admin' && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-[#5B6CFF]" />
                  <h3 className="font-semibold text-gray-900">Account Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Role',       value: 'Administrator' },
                    { label: 'Access',     value: 'Full Platform' },
                    { label: 'KYC',        value: 'Not Required'  },
                    { label: 'Joined',     value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="font-bold text-gray-900 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Stats — hidden for admins */}
            {user?.role !== 'admin' && stats && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-5 h-5 text-[#5B6CFF]" />
                  <h3 className="font-semibold text-gray-900">Activity</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Total Lent',     value: `${profileData?.totalLent     ?? profileData?.stats?.totalLent     ?? 0} pts` },
                    { label: 'Total Borrowed', value: `${profileData?.totalBorrowed ?? profileData?.stats?.totalBorrowed ?? 0} pts` },
                    { label: 'Active Borrows', value: stats.activeLoans ?? 0            },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-gray-900">{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage;
