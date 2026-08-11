import { Server as HTTPServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

/** Attach socket.io to the HTTP server. Call once at boot. */
export function initRealtime(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });
  io.on('connection', () => {
    // Connection is open — the client manages reconnection.
  });
  return io;
}

export function broadcastOrderUpdate(event: 'order:created' | 'order:status', payload: unknown) {
  io?.emit(event, payload);
}

export function broadcastTableUpdate(tableId: string | null) {
  if (tableId) io?.emit('table:updated', { id: tableId });
}
