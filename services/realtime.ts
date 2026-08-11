import { io, Socket } from 'socket.io-client';

type Listener = (payload: unknown) => void;

let socket: Socket | null = null;
const listeners = new Map<string, Set<Listener>>();

export function connectRealtime(baseUrl?: string) {
  if (socket) return socket;
  socket = io(baseUrl ?? '/', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });
  for (const [event, set] of listeners) {
    socket.on(event, (payload: unknown) => set.forEach((fn) => fn(payload)));
  }
  return socket;
}

export function onRealtime(event: string, fn: Listener): () => void {
  listeners.set(event, (listeners.get(event) ?? new Set()).add(fn));
  if (socket) socket.on(event, (payload: unknown) => fn(payload));
  return () => {
    const set = listeners.get(event);
    if (set) {
      set.delete(fn);
      if (socket) socket.off(event);
    }
  };
}