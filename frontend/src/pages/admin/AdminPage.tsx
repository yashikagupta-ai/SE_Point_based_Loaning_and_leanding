import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, AlertTriangle, BarChart2, UserCheck, UserX, RefreshCw, Clock,
  Package, Trash2, Settings, FileText, Shield, TrendingUp, Eye,
  Download, Search, Activity,
  MessageSquare, CheckCircle, XCircle, DollarSign
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { adminApi } from '@/services/api';
import { formatDate, cn } from '@/utils/helpers';

// ─── Types ──────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'users' | 'items' | 'transactions' | 'reports' | 'settings' | 'fraud';

// ─── Helpers ────────────────────────────────────────────────────────────────
function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    red:   'bg-red-100 text-red-700',
    yellow:'bg-yellow-100 text-yellow-700',
    blue:  'bg-blue-100 text-blue-700',
    gray:  'bg-gray-100 text-gray-600',
    purple:'bg-purple-100 text-purple-700',
  };
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', map[color] ?? map.gray)}>
      {children}
    </span>
  );
}

function StatCard({ label, value, color, bg, icon: Icon }: any) {
  return (
    <div className={cn('rounded-2xl p-4 border border-gray-100', bg)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">{label}</p>
        {Icon && <Icon className={cn('w-4 h-4', color)} />}
      </div>
      <p className={cn('text-2xl font-bold', color)}>{value ?? '—'}</p>
    </div>
  );
}

function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
        <p className="text-gray-500 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={cn('px-4 py-2 rounded-xl text-sm font-semibold text-white',
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#5B6CFF] hover:bg-[#4a5be0]')}>
            Confirm
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState<any>(null);

  // Data states
  const [overview,       setOverview]       = useState<any>(null);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [highRiskUsers,  setHighRiskUsers]  = useState<any[]>([]);
  const [users,          setUsers]          = useState<any[]>([]);
  const [items,          setItems]          = useState<any[]>([]);
  const [transactions,   setTransactions]   = useState<any[]>([]);
  const [fraudAlerts,    setFraudAlerts]    = useState<any>(null);
  const [categories,     setCategories]     = useState<any[]>([]);
  const [systemStats,    setSystemStats]    = useState<any>(null);

  // Filter states
  const [userSearch,   setUserSearch]   = useState('');
  const [itemSearch,   setItemSearch]   = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [txnType,      setTxnType]      = useState('');

  // Report states
  const [reportType,      setReportType]      = useState('overview');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate,   setReportEndDate]   = useState('');
  const [reportData,      setReportData]      = useState<any>(null);
  const [reportLoading,   setReportLoading]   = useState(false);

  // Settings state
  const [platformSettings, setPlatformSettings] = useState<any[]>([]);
  const [settingEdits,     setSettingEdits]     = useState<Record<string, string>>({});
  const [settingSaving,    setSettingSaving]    = useState<Record<string, boolean>>({});

  // Freeze reason modal
  const [freezeTarget, setFreezeTarget] = useState<any>(null);
  const [freezeReason, setFreezeReason] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        adminApi.getDashboard().then(r => {
          const d = r.data.data;
          setOverview(d?.overview ?? {});
          setRecentRequests(d?.recentRequests ?? []);
          setHighRiskUsers(d?.highRiskUsers ?? []);
        }),
        adminApi.getUsers().then(r => setUsers(r.data.data || [])),
        adminApi.getAllItems().then(r => setItems(r.data.data || [])),
        adminApi.getTransactions().then(r => setTransactions(r.data.data || [])),
        adminApi.getFraudAlerts().then(r => setFraudAlerts(r.data.data)),
        adminApi.getSettings().then(r => {
          const s = r.data.data || [];
          setPlatformSettings(s);
          const edits: Record<string, string> = {};
          s.forEach((item: any) => { edits[item.key] = String(item.value); });
          setSettingEdits(edits);
        }),
        adminApi.getStats().then(r => setSystemStats(r.data.data)),
      ]);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── User actions ──────────────────────────────────────────────────────────
  const doFreeze = async () => {
    if (!freezeTarget) return;
    try {
      await adminApi.freezeUser(freezeTarget._id, freezeReason);
      setUsers(us => us.map(u => u._id === freezeTarget._id ? { ...u, isActive: false } : u));
      showToast(`${freezeTarget.name} frozen`);
    } catch { showToast('Action failed'); }
    setFreezeTarget(null); setFreezeReason('');
  };

  const handleActivate = async (id: string, name: string) => {
    try {
      await adminApi.activateUser(id);
      setUsers(us => us.map(u => u._id === id ? { ...u, isActive: true } : u));
      showToast(`${name} activated`);
    } catch { showToast('Action failed'); }
  };

  // ── Item actions ──────────────────────────────────────────────────────────
  const handleDeleteItem = (item: any) => {
    setConfirm({
      title: 'Delete Inappropriate Item',
      message: `Permanently delete "${item.itemName}"? This cannot be undone. If borrowed, the borrower will be refunded.`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await adminApi.deleteItem(item._id);
          setItems(it => it.filter(i => i._id !== item._id));
          showToast('Item deleted');
        } catch { showToast('Failed to delete item'); }
      }
    });
  };

  const handleDeleteAllItems = () => {
    setConfirm({
      title: 'Delete ALL Items',
      message: 'Permanently delete ALL item listings? This cannot be undone.',
      onConfirm: async () => {
        setConfirm(null);
        try {
          const r = await adminApi.deleteAllItems();
          setItems([]);
          showToast(r.data.message || 'All items deleted');
        } catch { showToast('Failed to delete items'); }
      }
    });
  };

  // ── Reports ───────────────────────────────────────────────────────────────
  const generateReport = async () => {
    setReportLoading(true); setReportData(null);
    try {
      const params: any = {};
      if (reportStartDate) params.startDate = reportStartDate;
      if (reportEndDate)   params.endDate   = reportEndDate;
      const r = await adminApi.getReport(reportType, params);
      setReportData(r.data.data);
    } catch { showToast('Failed to generate report'); }
    setReportLoading(false);
  };

  const downloadReportCSV = async () => {
    try {
      const params: any = { format: 'csv' };
      if (reportStartDate) params.startDate = reportStartDate;
      if (reportEndDate)   params.endDate   = reportEndDate;
      const r = await adminApi.getReport(reportType, params);
      const blob = new Blob([r.data], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `${reportType}_report.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { showToast('CSV download failed'); }
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const saveSetting = async (key: string) => {
    const val = settingEdits[key];
    if (val === undefined || val === '') return;
    setSettingSaving(prev => ({ ...prev, [key]: true }));
    try {
      await adminApi.adjustSettings(key, Number(val));
      setPlatformSettings(prev => prev.map(s => s.key === key ? { ...s, value: Number(val) } : s));
      showToast('Setting saved');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to save setting');
    }
    setSettingSaving(prev => ({ ...prev, [key]: false }));
  };

  // ── Filtered views ────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredItems = items.filter(i =>
    (!itemSearch   || i.itemName?.toLowerCase().includes(itemSearch.toLowerCase())) &&
    (!itemCategory || i.category === itemCategory)
  );

  const filteredTxns = transactions.filter(t =>
    !txnType || t.type === txnType
  );

  // ── Fraud list ────────────────────────────────────────────────────────────
  const fraudList: any[] = fraudAlerts ? [
    ...(fraudAlerts.suspiciousLogins   ?? []).map((l: any) => ({ type: 'Suspicious Login Attempts', severity: 'HIGH',   description: `${l.attempts} failed attempts from ${l.email}`, createdAt: l.createdAt })),
    ...(fraudAlerts.suspiciousRequests ?? []).map((r: any) => ({ type: 'Excessive Borrow Requests', severity: 'MEDIUM', description: `User made ${r.count} borrow requests`,               createdAt: new Date().toISOString() })),
    ...(fraudAlerts.overdueLoans       ?? []).map((l: any) => ({ type: 'Points Not Returned',        severity: 'HIGH',   description: `${l.principal} pts overdue`,                         createdAt: l.dueDate })),
  ] : [];

  const tabs = [
    { key: 'overview',     label: 'Overview',      icon: BarChart2     },
    { key: 'users',        label: 'Users',          icon: Users         },
    { key: 'items',        label: 'Items',          icon: Package       },
    { key: 'transactions', label: 'Transactions',   icon: Activity      },
    { key: 'reports',      label: 'Reports',        icon: FileText      },
    { key: 'settings',     label: 'Settings',       icon: Settings      },
    { key: 'fraud',        label: 'Risk Alerts',    icon: AlertTriangle },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#5B6CFF] border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      {/* Freeze reason modal */}
      {freezeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 text-lg mb-1">Freeze Account</h3>
            <p className="text-gray-500 text-sm mb-4">Freezing <span className="font-semibold">{freezeTarget.name}</span></p>
            <textarea
              value={freezeReason}
              onChange={e => setFreezeReason(e.target.value)}
              placeholder="Reason for freezing (optional)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setFreezeTarget(null); setFreezeReason(''); }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={doFreeze}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold">
                Freeze Account
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div key="toast" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-20 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm shadow-lg">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#5B6CFF]" /> Admin Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-1">Platform management & monitoring</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleDeleteAllItems}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium">
              <Trash2 className="w-4 h-4" /> Delete All Items
            </button>
            <button onClick={reload} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
              <RefreshCw className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-gray-100 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as Tab)}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all',
                tab === t.key ? 'bg-[#5B6CFF] text-white shadow' : 'text-gray-500 hover:text-gray-700')}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
              {t.key === 'fraud' && fraudList.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                  {fraudList.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard label="Total Users"          value={overview?.totalUsers}               color="text-blue-600"    bg="bg-blue-50"    icon={Users}    />
              <StatCard label="New Today"             value={overview?.newUsersToday}             color="text-green-600"   bg="bg-green-50"   icon={UserCheck} />
              <StatCard label="Pending Requests"      value={overview?.pendingLoans}              color="text-yellow-600"  bg="bg-yellow-50"  icon={Clock}    />
              <StatCard label="Active Borrows"        value={overview?.activeLoans}               color="text-purple-600"  bg="bg-purple-50"  icon={Package}  />
              <StatCard label="Today's Transactions"  value={overview?.transactionsToday}         color="text-orange-600"  bg="bg-orange-50"  icon={Activity} />
              <StatCard label="Points in Circulation" value={overview?.totalPointsInCirculation}  color="text-[#5B6CFF]"   bg="bg-indigo-50"  icon={TrendingUp} />
            </div>

            {/* System stats breakdown */}
            {systemStats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-[#5B6CFF]" /> User Stats</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Total Users</span><span className="font-semibold">{systemStats.users?.total ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">KYC Verified</span><span className="font-semibold">{systemStats.users?.verified ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Active Accounts</span><span className="font-semibold">{systemStats.users?.active ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Avg Trust Score</span><span className="font-semibold">{systemStats.users?.avgCreditScore?.toFixed(0) ?? '—'}</span></div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500" /> Points Economy</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Total Points</span><span className="font-semibold">{systemStats.points?.totalPoints ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Locked Points</span><span className="font-semibold">{systemStats.points?.lockedPoints ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Avg Balance</span><span className="font-semibold">{systemStats.points?.avgBalance?.toFixed(1) ?? '—'}</span></div>
                  </div>
                </div>
              </div>
            )}

            {recentRequests.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#5B6CFF]" />
                  <h3 className="font-semibold text-gray-900">Recent Borrow Requests</h3>
                </div>
                <div className="space-y-3">
                  {recentRequests.map((req: any) => (
                    <div key={req._id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] flex items-center justify-center text-white text-sm font-bold">
                          {req.borrower?.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900">{req.borrower?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{req.purpose}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{req.amount} pts</p>
                        <p className="text-xs text-gray-400">{req.duration} days</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {highRiskUsers.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h3 className="font-semibold text-gray-900">High Risk Users</h3>
                  <Badge color="red">trust score &lt; 400</Badge>
                </div>
                <div className="space-y-3">
                  {highRiskUsers.map((u: any) => (
                    <div key={u._id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                      <span className="font-bold text-red-600">Score: {u.creditScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── USERS ─────────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-4 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 bg-white"
              />
            </div>

            {filteredUsers.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['User', 'Email', 'Trust Score', 'KYC', 'Status', 'Joined', 'Actions'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredUsers.map((u: any) => (
                        <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {u.name?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{u.name}</p>
                                <p className="text-xs text-gray-400 font-mono">{u.role === 'admin' ? 'admin' : u._id?.slice(-6)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">{u.creditScore ?? '—'}</td>
                          <td className="px-4 py-3">
                            <Badge color={u.isKYCVerified ? 'green' : 'yellow'}>
                              {u.isKYCVerified ? 'Verified' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge color={u.isActive ? 'green' : 'red'}>
                              {u.isActive ? 'Active' : 'Frozen'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                          <td className="px-4 py-3">
                            {u.role === 'admin' ? (
                              <span className="text-xs text-gray-400 italic">—</span>
                            ) : u.isActive ? (
                              <button onClick={() => setFreezeTarget(u)}
                                className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium">
                                <UserX className="w-3.5 h-3.5" /> Freeze
                              </button>
                            ) : (
                              <button onClick={() => handleActivate(u._id, u.name)}
                                className="flex items-center gap-1 text-xs text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors font-medium">
                                <UserCheck className="w-3.5 h-3.5" /> Unfreeze
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
                <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">No users found</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── ITEMS ─────────────────────────────────────────────────────────── */}
        {tab === 'items' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Category stats */}
            {categories.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {categories.map((c: any) => (
                  <button key={c.name}
                    onClick={() => setItemCategory(prev => prev === c.name ? '' : c.name)}
                    className={cn('rounded-xl p-3 border text-left transition-all',
                      itemCategory === c.name ? 'border-[#5B6CFF] bg-indigo-50' : 'border-gray-100 bg-white hover:border-gray-200')}>
                    <p className="text-xs text-gray-500 capitalize">{c.name}</p>
                    <p className="text-lg font-bold text-gray-900">{c.count}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                  placeholder="Search items…"
                  className="w-full pl-9 pr-4 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 bg-white" />
              </div>
              <select value={itemCategory} onChange={e => setItemCategory(e.target.value)}
                className="h-10 border border-gray-200 rounded-xl text-sm px-3 focus:outline-none bg-white text-gray-600">
                <option value="">All Categories</option>
                {categories.map((c: any) => <option key={c.name} value={c.name} className="capitalize">{c.name}</option>)}
              </select>
            </div>

            {filteredItems.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Item', 'Category', 'Lender', 'Points/day', 'Status', 'Listed', 'Actions'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredItems.map((item: any) => (
                        <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[160px]">{item.description}</p>
                          </td>
                          <td className="px-4 py-3"><Badge color="blue">{item.category}</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.lender?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.pointsPerDay}</td>
                          <td className="px-4 py-3">
                            <Badge color={item.status === 'available' ? 'green' : item.status === 'borrowed' ? 'yellow' : 'gray'}>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{formatDate(item.createdAt)}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDeleteItem(item)}
                              className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
                <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">No items found</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── TRANSACTIONS ──────────────────────────────────────────────────── */}
        {tab === 'transactions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex gap-2">
              <select value={txnType} onChange={e => setTxnType(e.target.value)}
                className="h-10 border border-gray-200 rounded-xl text-sm px-3 focus:outline-none bg-white text-gray-600">
                <option value="">All Types</option>
                {['lending', 'borrowing', 'repayment', 'penalty', 'reward', 'interest', 'signup_bonus'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {filteredTxns.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Type', 'Amount', 'From', 'To', 'Reference', 'Date'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredTxns.map((t: any) => (
                        <tr key={t._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3"><Badge color="blue">{t.type}</Badge></td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">{t.amount} pts</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{t.fromUser?.name ?? 'System'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{t.toUser?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{t.reference ?? t._id?.slice(-8)}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{formatDate(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
                <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">No transactions found</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── REPORTS ───────────────────────────────────────────────────────── */}
        {tab === 'reports' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#5B6CFF]" /> Generate Report
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                <select value={reportType} onChange={e => setReportType(e.target.value)}
                  className="h-10 border border-gray-200 rounded-xl text-sm px-3 focus:outline-none bg-gray-50 col-span-1">
                  <option value="overview">Platform Overview</option>
                  <option value="users">Users Report</option>
                  <option value="transactions">Transactions Report</option>
                  <option value="items">Items Report</option>
                </select>
                <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)}
                  placeholder="Start date"
                  className="h-10 border border-gray-200 rounded-xl text-sm px-3 focus:outline-none bg-gray-50" />
                <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)}
                  placeholder="End date"
                  className="h-10 border border-gray-200 rounded-xl text-sm px-3 focus:outline-none bg-gray-50" />
                <div className="flex gap-2">
                  <button onClick={generateReport} disabled={reportLoading}
                    className="flex-1 h-10 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                    {reportLoading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><Eye className="w-4 h-4" /> Generate</>}
                  </button>
                  <button onClick={downloadReportCSV} title="Download CSV"
                    className="h-10 w-10 border border-gray-200 hover:bg-gray-50 rounded-xl flex items-center justify-center text-gray-500 transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {reportData && (
                <div className="mt-4 border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-700 mb-3">{reportData.title}</p>
                  {reportData.summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {Object.entries(reportData.summary).map(([k, v]: any) => (
                        <div key={k} className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-xs text-gray-400 capitalize">{k.replace(/_/g, ' ')}</p>
                          <p className="text-lg font-bold text-gray-900 mt-0.5">{typeof v === 'object' ? JSON.stringify(v) : v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {reportData.total !== undefined && (
                    <p className="text-sm text-gray-500">Total records: <span className="font-bold text-gray-900">{reportData.total}</span></p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">Generated: {new Date(reportData.generated).toLocaleString()}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── SETTINGS ──────────────────────────────────────────────────────── */}
        {tab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#5B6CFF]" /> System Settings
              </h3>
              <p className="text-sm text-gray-400 mb-6">Changes take effect immediately for all new activity on the platform.</p>

              <div className="space-y-4">
                {platformSettings.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">Loading settings…</div>
                )}
                {platformSettings.map((s: any) => (
                  <div key={s.key} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{s.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{s.key}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Range: {s.min} – {s.max} &nbsp;·&nbsp; Default: {s.default}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        min={s.min}
                        max={s.max}
                        value={settingEdits[s.key] ?? String(s.value)}
                        onChange={e => setSettingEdits(prev => ({ ...prev, [s.key]: e.target.value }))}
                        className="w-24 h-9 border border-gray-200 rounded-lg text-sm px-3 text-center focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 bg-white font-semibold text-gray-900"
                      />
                      <button
                        onClick={() => saveSetting(s.key)}
                        disabled={settingSaving[s.key] || String(settingEdits[s.key]) === String(s.value)}
                        className="h-9 px-4 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                        {settingSaving[s.key]
                          ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <><CheckCircle className="w-3.5 h-3.5" /> Save</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── FRAUD / RISK ALERTS ────────────────────────────────────────────── */}
        {tab === 'fraud' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {fraudList.length > 0 ? (
              <div className="space-y-3">
                {fraudList.map((alert: any, i: number) => (
                  <div key={i} className="bg-white rounded-2xl p-5 border border-red-100 flex items-start gap-4">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      alert.severity === 'HIGH' ? 'bg-red-100' : 'bg-yellow-100')}>
                      <AlertTriangle className={cn('w-5 h-5', alert.severity === 'HIGH' ? 'text-red-600' : 'text-yellow-600')} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{alert.type}</p>
                        <Badge color={alert.severity === 'HIGH' ? 'red' : 'yellow'}>{alert.severity}</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{alert.description}</p>
                      {alert.createdAt && <p className="text-xs text-gray-400 mt-1">{formatDate(alert.createdAt)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
                <Shield className="w-12 h-12 text-green-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No risk alerts</p>
                <p className="text-gray-400 text-sm mt-1">Platform looks healthy</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default AdminPage;
