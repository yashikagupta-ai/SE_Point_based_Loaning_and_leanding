import { io, Socket } from 'socket.io-client';

const SOCKET_URL = typeof window !== 'undefined'
  ? window.location.origin.replace(/:\d+$/, ':5000')
  : 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
