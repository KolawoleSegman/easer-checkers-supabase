import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './client';
let active: Socket | null = null;
export function connectSocket(token: string) {
  if (active && (active.auth as any)?.token !== token) { active.disconnect(); active = null; }
  if (!active) active = io(API_BASE_URL, { auth: { token }, transports: ['websocket'], reconnection: true, reconnectionDelay: 700, reconnectionDelayMax: 5000, timeout: 10000 });
  return active;
}
export function disconnectSocket() { active?.disconnect(); active = null; }
