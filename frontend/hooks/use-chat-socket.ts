'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getBearerToken, getSession, hasActiveSession, usesCookieAuth } from '../lib/auth';
import type { Conversation, Message } from '../lib/chat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4545';

export const CHAT_SOCKET_EVENTS = {
  MESSAGE_NEW: 'chat:message_new',
  MESSAGE_READ: 'chat:message_read',
  TYPING: 'chat:typing',
  CONVERSATION_ASSIGNED: 'chat:conversation_assigned',
  CONVERSATION_CLOSED: 'chat:conversation_closed',
  CONVERSATION_UPDATED: 'chat:conversation_updated',
  UNREAD_COUNT: 'chat:unread_count',
} as const;

type Handlers = {
  onMessage?: (conversationId: string, message: Message) => void;
  onRead?: (conversationId: string, userId: string) => void;
  onTyping?: (conversationId: string, userId: string | undefined, isTyping: boolean) => void;
  onConversationUpdated?: (conversation: Conversation) => void;
  onUnreadCount?: (count: number) => void;
};

export function useChatSocket(
  activeConversationId: string | null,
  handlers: Handlers,
  enabled = true,
) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const session = getSession();
    if (!hasActiveSession(session)) return;

    const token = getBearerToken(session);

    const socket = io(`${API_BASE}/chat`, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      withCredentials: usesCookieAuth(),
    });
    socketRef.current = socket;

    socket.on(CHAT_SOCKET_EVENTS.MESSAGE_NEW, (payload: { conversationId: string; message: Message }) => {
      handlersRef.current.onMessage?.(payload.conversationId, payload.message);
    });
    socket.on(CHAT_SOCKET_EVENTS.MESSAGE_READ, (payload: { conversationId: string; userId: string }) => {
      handlersRef.current.onRead?.(payload.conversationId, payload.userId);
    });
    socket.on(CHAT_SOCKET_EVENTS.TYPING, (payload: { conversationId: string; userId?: string; isTyping: boolean }) => {
      handlersRef.current.onTyping?.(payload.conversationId, payload.userId, payload.isTyping);
    });
    socket.on(CHAT_SOCKET_EVENTS.CONVERSATION_ASSIGNED, (conv: Conversation) => {
      handlersRef.current.onConversationUpdated?.(conv);
    });
    socket.on(CHAT_SOCKET_EVENTS.CONVERSATION_CLOSED, (conv: Conversation) => {
      handlersRef.current.onConversationUpdated?.(conv);
    });
    socket.on(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, (conv: Conversation) => {
      handlersRef.current.onConversationUpdated?.(conv);
    });
    socket.on(CHAT_SOCKET_EVENTS.UNREAD_COUNT, (payload: { count: number }) => {
      handlersRef.current.onUnreadCount?.(payload.count);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  // Subscribe to the active conversation room.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConversationId) return;

    socket.emit('conversation:subscribe', { conversationId: activeConversationId });
    return () => {
      socket.emit('conversation:unsubscribe', { conversationId: activeConversationId });
    };
  }, [activeConversationId]);

  function emitTyping(conversationId: string, isTyping: boolean) {
    socketRef.current?.emit('chat:typing', { conversationId, isTyping });
  }

  return { emitTyping };
}
