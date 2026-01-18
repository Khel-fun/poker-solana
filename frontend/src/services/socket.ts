import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types';

const SOCKET_URL = 'http://localhost:3001';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export const getSocket = (): GameSocket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
    });
  }
  return socket;
};

export const connectSocket = (): GameSocket => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = (): void => {
  if (socket?.connected) {
    socket.disconnect();
  }
};
