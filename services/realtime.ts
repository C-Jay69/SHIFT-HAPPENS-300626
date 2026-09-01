import { io, Socket } from 'socket.io-client';
import { useState, useEffect, useCallback } from 'react';

type Listener = (payload: unknown) => void;
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

let socket: Socket | null = null;
const listeners = new Map<string, Set<Listener>>();
const statusListeners = new Set<(status: ConnectionStatus) => void>();
let currentStatus: ConnectionStatus = 'disconnected';

function setStatus(status: ConnectionStatus) {
  currentStatus = status;
  statusListeners.forEach((fn) => fn(status));
}

export function getConnectionStatus(): ConnectionStatus {
  return currentStatus;
}

export function onConnectionStatusChange(fn: (status: ConnectionStatus) => void): () => void {
  statusListeners.add(fn);
  fn(currentStatus);
  return () => statusListeners.delete(fn);
}

export function connectRealtime(baseUrl?: string) {
  if (socket) return socket;
  setStatus('connecting');
  socket = io(baseUrl ?? '/', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });
  socket.on('connect', () => setStatus('connected'));
  socket.on('disconnect', () => setStatus('disconnected'));
  socket.on('connect_error', () => setStatus('disconnected'));
  for (const [event, set] of listeners) {
    socket.on(event, (payload: unknown) => set.forEach((fn) => fn(payload)));
  }
  return socket;
}

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus());
  useEffect(() => onConnectionStatusChange(setStatus), []);
  return status;
}

export function onRealtime(event: string, fn: Listener): () => void {
  listeners.set(event, (listeners.get(event) ?? new Set()).add(fn));
  if (socket) socket.on(event, (payload: unknown) => fn(payload));
  return () => {
    const set = listeners.get(event);
    if (set) {
      set.delete(fn);
      if (socket && set.size === 0) {
        socket.off(event);
        listeners.delete(event);
      }
    }
  };
}