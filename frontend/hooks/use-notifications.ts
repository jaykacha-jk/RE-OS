'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getBearerToken, getSession, hasActiveSession, usesCookieAuth } from '../lib/auth';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../lib/notifications';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4545';

export const NOTIFICATION_SOCKET_EVENTS = {
  RECEIVED: 'notification:received',
  UNREAD_COUNT: 'notification:unread_count',
  READ: 'notification:read',
} as const;

export function useNotifications(opts?: { enabled?: boolean; listLimit?: number }) {
  const enabled = opts?.enabled ?? true;
  const listLimit = opts?.listLimit ?? 30;

  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const refresh = useCallback(async () => {
    const session = getSession();
    if (!hasActiveSession(session)) {
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [list, count] = await Promise.all([
        fetchNotifications({ per_page: listLimit }),
        fetchUnreadCount(),
      ]);
      setItems(list.data);
      setUnreadCount(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [listLimit]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  // Realtime socket — reconnects when the access token changes.
  useEffect(() => {
    if (!enabled) return;
    const session = getSession();
    if (!hasActiveSession(session)) return;

    const token = getBearerToken(session);

    const socket = io(`${API_BASE}/notifications`, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      withCredentials: usesCookieAuth(),
    });
    socketRef.current = socket;

    socket.on(NOTIFICATION_SOCKET_EVENTS.RECEIVED, (notification: Notification) => {
      setItems((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev].slice(0, listLimit);
      });
      if (!notification.is_read) {
        setUnreadCount((c) => c + 1);
      }
    });

    socket.on(NOTIFICATION_SOCKET_EVENTS.UNREAD_COUNT, (payload: { count: number }) => {
      if (typeof payload?.count === 'number') setUnreadCount(payload.count);
    });

    socket.on(NOTIFICATION_SOCKET_EVENTS.READ, (payload: { id?: string; all?: boolean; unread_count: number }) => {
      if (typeof payload?.unread_count === 'number') setUnreadCount(payload.unread_count);
      if (payload?.all) {
        setItems((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() })));
      } else if (payload?.id) {
        setItems((prev) =>
          prev.map((n) =>
            n.id === payload.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
          ),
        );
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, listLimit]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setItems((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() })),
    );
    setUnreadCount(0);
  }, []);

  return {
    items,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}
