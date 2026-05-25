import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Socket URL resolution:
 * - VITE_SOCKET_URL: always use this when set (e.g. production or custom API host).
 * - Dev + no override: connect straight to VITE_DEV_BACKEND_URL (defaults with vite.config.ts).
 *   Avoids Vite's /socket.io WS proxy, which often spams ECONNABORTED on Windows when tabs/HMR reconnect.
 * - Production build, no VITE_SOCKET_URL: same origin (reverse proxy serves API + static).
 */
function socketUrl(): string | undefined {
  const explicit = import.meta.env.VITE_SOCKET_URL?.trim();
  if (explicit) return explicit;

  if (import.meta.env.DEV) {
    const devBackend = import.meta.env.VITE_DEV_BACKEND_URL?.trim().replace(/\/$/, '') ?? '';
    return devBackend.length > 0 ? devBackend : 'http://localhost:4000';
  }

  return undefined;
}

export function useSocket(enabled: boolean): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSocket(null);
      return;
    }
    const s = io(socketUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    setSocket(s);
    return () => {
      s.close();
    };
  }, [enabled]);

  return socket;
}
