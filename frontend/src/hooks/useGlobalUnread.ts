// hooks/useGlobalUnread.ts
// This hook runs at the Layout level (i.e. every page) and listens for
// incoming socket messages. When a message arrives for a conversation that
// is NOT currently open, it increments the unread counter in localStorage
// and fires the 'il_unread_update' CustomEvent so the Sidebar badge updates
// instantly — even when the user is not on the Messages page.

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { getSocket } from '@/services/socket';
import type { ChatMessage } from '@/types';

const CONVOS_KEY = 'il_conversations';

// Read the active conversation id that MessagesPage stores so we don't
// double-count messages the user can currently see.
const ACTIVE_CONVO_KEY = 'il_active_convo';

function bumpUnread(userId: string, peerId: string, peerName: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(`${CONVOS_KEY}_${userId}`) || '{}');
    const activeConvo = localStorage.getItem(ACTIVE_CONVO_KEY) || '';

    // If the conversation is currently open, don't add to unread
    if (activeConvo === peerId) return;

    if (!raw[peerId]) {
      raw[peerId] = { peerId, peerName, messages: [], unread: 0 };
    }
    raw[peerId].unread = (raw[peerId].unread || 0) + 1;
    localStorage.setItem(`${CONVOS_KEY}_${userId}`, JSON.stringify(raw));
    window.dispatchEvent(new CustomEvent('il_unread_update'));
  } catch {
    // silently ignore
  }
}

export function useGlobalUnread() {
  const { user } = useSelector((s: RootState) => s.auth);
  const userId = user?.id ?? (user as any)?._id ?? '';
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const sock = getSocket();

    // Register this user with the socket server so messages are routed here
    sock.emit('register', userId);

    const onNewMessage = (msg: ChatMessage) => {
      const uid = userIdRef.current;
      if (!uid) return;
      // Only care about messages sent TO us, not our own outgoing ones
      if (msg.senderId === uid) return;
      const peerId = msg.senderId;
      bumpUnread(uid, peerId, msg.senderName);
    };

    sock.on('new_message', onNewMessage);
    return () => { sock.off('new_message', onNewMessage); };
  }, [userId]);
}
