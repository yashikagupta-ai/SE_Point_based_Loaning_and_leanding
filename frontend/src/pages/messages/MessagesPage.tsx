import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  MessageSquare, Send, Plus, Search, X, ArrowLeft,
  Wifi, WifiOff, UserPlus, Check, Bell, Trash2,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import type { RootState } from '@/store';
import type { ChatMessage } from '@/types';
import { cn, formatRelativeTime } from '@/utils/helpers';
import { getSocket } from '@/services/socket';
import { chatApi } from '@/services/api';

interface Conversation {
  peerId: string;
  peerName: string;
  messages: ChatMessage[];
  unread: number;       // messages received while this convo is NOT active
}

interface ChatRequest {
  _id: string;
  from: { _id: string; name: string; email: string };
  to:   { _id: string; name: string; email: string } | string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  createdAt: string;
}

const CONVOS_KEY = 'il_conversations';
const ACTIVE_CONVO_KEY = 'il_active_convo';

function loadConvos(uid: string): Record<string, Conversation> {
  try {
    const raw = JSON.parse(localStorage.getItem(`${CONVOS_KEY}_${uid}`) || '{}');
    // Ensure unread field exists on every convo
    Object.values(raw).forEach((c: any) => { if (c.unread === undefined) c.unread = 0; });
    return raw;
  } catch { return {}; }
}
function saveConvos(uid: string, c: Record<string, Conversation>) {
  localStorage.setItem(`${CONVOS_KEY}_${uid}`, JSON.stringify(c));
  // Dispatch a named custom event so the Sidebar updates on the same tab.
  // The native 'storage' StorageEvent only fires in *other* tabs; a plain
  // Event('storage') is a different type and won't be caught by the Sidebar's
  // StorageEvent listener. Using a dedicated event name fixes this.
  window.dispatchEvent(new CustomEvent('il_unread_update'));
}

type Tab = 'chats' | 'requests';

const MessagesPage: React.FC = () => {
  const { user } = useSelector((s: RootState) => s.auth);
  const userId   = user?.id ?? (user as any)?._id ?? '';
  const userName = user?.name ?? 'Me';

  const [tab,            setTab]            = useState<Tab>('chats');
  const [convos,         setConvos]         = useState<Record<string, Conversation>>({});
  const [activeId,       setActiveId]       = useState<string | null>(null);
  const [text,           setText]           = useState('');
  const [showNew,        setShowNew]        = useState(false);
  const [newPeerId,      setNewPeerId]      = useState('');
  const [newMessage,     setNewMessage]     = useState('');
  const [search,         setSearch]         = useState('');
  const [mobileChat,     setMobileChat]     = useState(false);
  const [connected,      setConnected]      = useState(false);
  const [incoming,       setIncoming]       = useState<ChatRequest[]>([]);
  const [outgoing,       setOutgoing]       = useState<ChatRequest[]>([]);
  const [contacts,       setContacts]       = useState<{ peerId: string; peerName: string }[]>([]);
  const [requestSending, setRequestSending] = useState(false);
  const [toast,          setToast]          = useState('');
  const bottomRef  = useRef<HTMLDivElement>(null);
  const socketRef  = useRef(getSocket());
  // Keep activeId in a ref so the socket callback can read it without stale closure
  const activeIdRef = useRef<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Clear the active convo key when leaving the Messages page entirely
  useEffect(() => {
    return () => { localStorage.removeItem(ACTIVE_CONVO_KEY); };
  }, []);

  // Load persisted conversations
  useEffect(() => {
    if (!userId) return;
    setConvos(loadConvos(userId));
  }, [userId]);

  // Load chat contacts & requests, and detect any messages missed while offline
  const reloadRequests = useCallback(() => {
    chatApi.getIncoming().then(r => setIncoming(r.data.data || [])).catch(() => {});
    chatApi.getOutgoing().then(r => setOutgoing(r.data.data || [])).catch(() => {});

    // Fetch contacts AND unread info in parallel
    Promise.all([
      chatApi.getContacts(),
      chatApi.getUnread(),
    ]).then(([contactsRes, unreadRes]) => {
      const c: { peerId: string; peerName: string }[] = contactsRes.data.data || [];
      const unreadData: { peerId: string; peerName: string; lastMessage: { senderId: string; text: string; createdAt: string } | null }[] =
        unreadRes.data.data || [];

      setContacts(c);
      setConvos(prev => {
        const next = { ...prev };

        c.forEach(({ peerId, peerName }) => {
          if (!next[peerId]) next[peerId] = { peerId, peerName, messages: [], unread: 0 };
        });

        // For each contact, check if the server's last message is newer than what
        // we have in localStorage. If so, and it was sent by the peer (not us),
        // and we don't already have it in our messages list, mark as unread.
        unreadData.forEach(({ peerId, peerName, lastMessage }) => {
          if (!lastMessage) return;
          if (lastMessage.senderId === userId) return; // our own message, not unread

          const convo = next[peerId];
          // Check if we already have this message stored locally
          const alreadyHave = convo?.messages?.some(
            m => m.timestamp === lastMessage.createdAt || m.text === lastMessage.text
          );

          if (!alreadyHave) {
            // We missed this message (arrived while offline / before socket registered)
            if (!next[peerId]) next[peerId] = { peerId, peerName, messages: [], unread: 0 };
            // Only increment if the convo isn't currently open
            if (activeIdRef.current !== peerId) {
              next[peerId] = { ...next[peerId], unread: (next[peerId].unread || 0) + 1 };
            }
          }
        });

        saveConvos(userId, next);
        return next;
      });
    }).catch(() => {});
  }, [userId]);

  useEffect(() => { if (userId) reloadRequests(); }, [userId, reloadRequests]);

  // Socket setup
  useEffect(() => {
    if (!userId) return;
    const sock = socketRef.current;

    sock.emit('register', userId);
    setConnected(sock.connected);

    sock.on('connect',    () => setConnected(true));
    sock.on('disconnect', () => setConnected(false));

    sock.on('new_message', (msg: ChatMessage) => {
      const peerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const isCurrentlyOpen = activeIdRef.current === peerId;

      setConvos(prev => {
        const next = { ...prev };
        if (!next[peerId]) next[peerId] = { peerId, peerName: msg.senderName, messages: [], unread: 0 };
        const exists = next[peerId].messages.some(m => m.id === msg.id);
        if (!exists) {
          next[peerId] = {
            ...next[peerId],
            messages: [...next[peerId].messages, msg],
            // Only increment unread if it's an incoming message and the convo isn't open
            unread: (msg.senderId !== userId && !isCurrentlyOpen)
              ? next[peerId].unread + 1
              : next[peerId].unread
          };
        }
        saveConvos(userId, next);
        return next;
      });
    });

    sock.on('message_history', ({ peerId, messages }: { peerId: string; messages: ChatMessage[] }) => {
      setConvos(prev => {
        const next = { ...prev };
        if (next[peerId]) {
          // Do NOT reset unread here — openConvo() already clears it when the user
          // clicks the conversation. Resetting here would wipe the badge before
          // the user actually sees the message.
          next[peerId] = { ...next[peerId], messages };
        }
        saveConvos(userId, next);
        return next;
      });
    });

    sock.on('error_message', ({ message }: { message: string }) => showToast(message));

    return () => {
      sock.off('connect');
      sock.off('disconnect');
      sock.off('new_message');
      sock.off('message_history');
      sock.off('error_message');
    };
  }, [userId]);

  // Auto-scroll to bottom when messages change in active convo
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeId, convos[activeId ?? '']?.messages?.length]);

  const openConvo = useCallback((peerId: string) => {
    setActiveId(peerId);
    setMobileChat(true);
    localStorage.setItem(ACTIVE_CONVO_KEY, peerId); // tell global hook this convo is open
    // Clear unread for this convo immediately
    setConvos(prev => {
      if (!prev[peerId] || prev[peerId].unread === 0) return prev;
      const next = { ...prev, [peerId]: { ...prev[peerId], unread: 0 } };
      saveConvos(userId, next);
      return next;
    });
    socketRef.current.emit('load_messages', { userId, peerId });
  }, [userId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    socketRef.current.emit('send_message', {
      senderId: userId, senderName: userName,
      receiverId: activeId, text: text.trim(),
    });
    setText('');
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = newPeerId.trim();
    if (!pid) return;
    setRequestSending(true);
    try {
      await chatApi.sendRequest(pid, newMessage.trim() || undefined);
      showToast('Chat request sent!');
      setShowNew(false);
      setNewPeerId('');
      setNewMessage('');
      reloadRequests();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to send request');
    } finally { setRequestSending(false); }
  };

  const handleAccept = async (id: string) => {
    try {
      await chatApi.acceptRequest(id);
      showToast('Chat accepted!');
      reloadRequests();
    } catch { showToast('Failed'); }
  };

  const handleDecline = async (id: string) => {
    try {
      await chatApi.declineRequest(id);
      showToast('Request declined');
      reloadRequests();
    } catch { showToast('Failed'); }
  };

  const contactIds = new Set(contacts.map(c => c.peerId));
  const filteredConvos = Object.values(convos)
    // Show a convo if: it's in the accepted contacts list OR it has unread messages
    // (so a new message from an accepted contact shows immediately, even before the
    // contacts REST response has refreshed)
    .filter(c => contactIds.has(c.peerId) || c.unread > 0)
    .filter(c =>
      c.peerName.toLowerCase().includes(search.toLowerCase()) ||
      c.peerId.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      // Unread convos always float to top, then sort by last message time desc
      if (b.unread !== a.unread) return b.unread - a.unread;
      const aLast = a.messages[a.messages.length - 1]?.timestamp ?? '';
      const bLast = b.messages[b.messages.length - 1]?.timestamp ?? '';
      return bLast.localeCompare(aLast);
    });

  const active = activeId ? convos[activeId] : null;
  const pendingIncoming = incoming.filter(r => r.status === 'pending');
  const totalUnread = Object.values(convos).reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <Layout>
      <div className="max-w-5xl">
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="fixed top-20 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm shadow-lg">
            {toast}
          </motion.div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            {totalUnread > 0 && (
              <span className="bg-[#5B6CFF] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {pendingIncoming.length > 0 && (
              <button onClick={() => setTab('requests')}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-orange-100 text-orange-700">
                <Bell className="w-3.5 h-3.5" />
                {pendingIncoming.length} pending
              </button>
            )}
            <div className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full',
              connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {connected ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['chats', 'requests'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize relative',
                tab === t ? 'bg-[#5B6CFF] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
              {t}
              {t === 'chats' && totalUnread > 0 && tab !== 'chats' && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#5B6CFF] text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {totalUnread}
                </span>
              )}
              {t === 'requests' && pendingIncoming.length > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingIncoming.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Requests tab */}
        {tab === 'requests' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#5B6CFF]" /> Incoming Requests
              </h3>
              {pendingIncoming.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No pending requests</p>
              ) : pendingIncoming.map(r => (
                <div key={r._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {r.from.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{r.from.name}</p>
                    <p className="text-xs text-gray-400 truncate">{r.from.email}</p>
                    {(r as any).itemTitle && (
                      <p className="text-xs text-[#5B6CFF] mt-0.5 font-medium">📦 Re: {(r as any).itemTitle}</p>
                    )}
                    {r.message && <p className="text-xs text-gray-500 mt-0.5 italic">"{r.message}"</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleDecline(r._id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleAccept(r._id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#5B6CFF] text-white rounded-lg text-xs font-medium hover:bg-[#4a5be0] transition-colors">
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Sent Requests</h3>
              {outgoing.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No sent requests</p>
              ) : outgoing.map(r => {
                const peer = typeof r.to === 'object' ? r.to : null;
                return (
                  <div key={r._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm flex-shrink-0">
                      {peer?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{peer?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{peer?.email}</p>
                    </div>
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full capitalize',
                      r.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      r.status === 'declined' ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-700')}>
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chats tab */}
        {tab === 'chats' && (
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden flex shadow-sm" style={{ height: '68vh' }}>
            {/* Sidebar */}
            <div className={cn('w-full sm:w-72 border-r border-gray-100 flex flex-col flex-shrink-0',
              mobileChat ? 'hidden sm:flex' : 'flex')}>
              <div className="p-4 border-b border-gray-100 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search chats…"
                    className="w-full pl-9 pr-3 h-9 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/20 border border-gray-100" />
                </div>
                <button onClick={() => setShowNew(true)}
                  className="w-full h-9 bg-[#5B6CFF] text-white rounded-xl text-sm font-medium hover:bg-[#4a5be0] transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> New Chat Request
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredConvos.length > 0 ? filteredConvos.map(conv => {
                  const last = conv.messages[conv.messages.length - 1];
                  const isActive = activeId === conv.peerId;
                  const hasUnread = conv.unread > 0;
                  return (
                    <button key={conv.peerId} onClick={() => openConvo(conv.peerId)}
                      className={cn('w-full text-left px-4 py-3 flex items-center gap-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                        isActive ? 'bg-blue-50' : hasUnread ? 'bg-[#5B6CFF]/5' : '')}>
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] flex items-center justify-center text-white font-bold">
                          {conv.peerName[0].toUpperCase()}
                        </div>
                        {/* Online / unread indicator dot */}
                        {hasUnread && (
                          <span className="absolute -top-1 -right-1 bg-[#5B6CFF] text-white text-xs font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shadow-sm">
                            {conv.unread > 99 ? '99+' : conv.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm truncate', hasUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900')}>
                          {conv.peerName}
                        </p>
                        <p className={cn('text-xs truncate', hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400')}>
                          {last?.text ?? 'Say hello 👋'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {last && <span className="text-xs text-gray-300">{formatRelativeTime(last.timestamp)}</span>}
                      </div>
                    </button>
                  );
                }) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <MessageSquare className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-sm text-gray-400">No accepted chats yet</p>
                    <p className="text-xs text-gray-300 mt-1">Send a chat request to get started</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chat pane */}
            <div className={cn('flex-1 flex flex-col', !mobileChat ? 'hidden sm:flex' : 'flex')}>
              {active ? (
                <>
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                    <button onClick={() => setMobileChat(false)} className="sm:hidden p-1 rounded-lg hover:bg-gray-100">
                      <ArrowLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] flex items-center justify-center text-white font-bold text-sm">
                      {active.peerName[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{active.peerName}</p>
                      <p className="text-xs text-gray-400 font-mono">{active.peerId}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {active.messages.length === 0 && (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-sm text-gray-300">No messages yet — say hello!</p>
                      </div>
                    )}
                    <AnimatePresence initial={false}>
                      {active.messages.map(msg => {
                        const isMe = msg.senderId === userId;
                        return (
                          <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                            <div className={cn('max-w-[72%] px-4 py-2.5 rounded-2xl text-sm',
                              isMe ? 'bg-[#5B6CFF] text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm')}>
                              <p className="break-words">{msg.text}</p>
                              <p className={cn('text-xs mt-1 text-right', isMe ? 'text-white/60' : 'text-gray-400')}>
                                {formatRelativeTime(msg.timestamp)}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    <div ref={bottomRef} />
                  </div>

                  <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-3">
                    <input value={text} onChange={e => setText(e.target.value)}
                      placeholder="Type a message…"
                      className="flex-1 px-4 h-11 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/20 focus:border-[#5B6CFF]" />
                    <button type="submit" disabled={!text.trim()}
                      className="w-11 h-11 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-[#5B6CFF]/10 rounded-2xl flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-[#5B6CFF]" />
                  </div>
                  <p className="font-semibold text-gray-700">Select a conversation</p>
                  <p className="text-sm text-gray-400 mt-1">or send a chat request to start messaging</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* New chat request modal */}
        {showNew && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Send Chat Request</h2>
                <button type="button" onClick={() => setShowNew(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleSendRequest} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">User ID *</label>
                  <input type="text" required value={newPeerId} onChange={e => setNewPeerId(e.target.value)}
                    placeholder="Paste their MongoDB user ID"
                    className="w-full px-4 h-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF]" />
                  <p className="text-xs text-gray-400 mt-1">Find this on their Profile page.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Message (optional)</label>
                  <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    placeholder="e.g. Hi, I saw your item post!"
                    maxLength={200}
                    className="w-full px-4 h-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF]" />
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                  The other user must accept before you can chat.
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowNew(false)}
                    className="flex-1 h-11 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors">Cancel</button>
                  <button type="submit" disabled={requestSending}
                    className="flex-1 h-11 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center">
                    {requestSending
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : 'Send Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MessagesPage;
