import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { APP_CONFIG } from '@client/src/config';
import { getAuth, getProfile } from '@client/src/lib/storage';

type EventCallback = (data: unknown) => void;

interface UseWebSocketReturn {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (event: string, data: unknown) => void;
  on: (event: string, callback: EventCallback) => void;
  off: (event: string, callback: EventCallback) => void;
}

let socketSingleton: Socket | null = null;
const listeners = new Map<string, Set<EventCallback>>();

function getSocketUrl(): string {
  if (APP_CONFIG.wsUrl) return APP_CONFIG.wsUrl;
  return '/location';
}

function createSocket(): Socket {
  const auth = getAuth();
  const profile = getProfile();
  const socket = io(getSocketUrl(), {
    path: '/api/socket.io',
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    transports: ['websocket', 'polling'],
    auth: auth
      ? {
          userId: auth.userId,
          token: auth.token,
          nickname: profile?.nickname || auth.userId,
          userName: auth.userId,
        }
      : undefined,
  });

  socket.on('connect', () => {
    logger.info('websocket connected');
  });

  socket.on('disconnect', (reason) => {
    logger.info('websocket disconnected', { reason });
  });

  socket.on('connect_error', (err) => {
    logger.error('websocket connect error', err);
  });

  // 转发所有事件到注册的 listeners
  socket.onAny((event: string, ...args: unknown[]) => {
    const cbs = listeners.get(event);
    if (!cbs) return;
    for (const cb of cbs) {
      try {
        cb(args[0]);
      } catch (err) {
        logger.error(`ws event handler error: ${event}`, err);
      }
    }
  });

  return socket;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const connectedRef = useRef(false);

  // 确保单例
  const getSocket = useCallback((): Socket => {
    if (!socketSingleton) {
      socketSingleton = createSocket();
    }
    return socketSingleton;
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = (): void => {
      setIsConnected(true);
      connectedRef.current = true;
    };
    const handleDisconnect = (): void => {
      setIsConnected(false);
      connectedRef.current = false;
    };

    setIsConnected(socket.connected);
    connectedRef.current = socket.connected;

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [getSocket]);

  const connect = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) {
      // 每次连接前刷新 auth 信息
      const auth = getAuth();
      const profile = getProfile();
      if (auth) {
        socket.auth = {
          userId: auth.userId,
          token: auth.token,
          nickname: profile?.nickname || auth.userId,
          userName: auth.userId,
        };
      }
      socket.connect();
    }
  }, [getSocket]);

  const disconnect = useCallback(() => {
    const socket = getSocket();
    if (socket.connected) {
      socket.disconnect();
    }
  }, [getSocket]);

  const send = useCallback(
    (event: string, data: unknown) => {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit(event, data);
      } else {
        logger.warn(`ws send skipped (not connected): ${event}`);
      }
    },
    [getSocket],
  );

  const on = useCallback((event: string, callback: EventCallback) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(callback);
  }, []);

  const off = useCallback((event: string, callback: EventCallback) => {
    const cbs = listeners.get(event);
    if (!cbs) return;
    cbs.delete(callback);
    if (cbs.size === 0) {
      listeners.delete(event);
    }
  }, []);

  return { isConnected, connect, disconnect, send, on, off };
}
