'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { CHAT_SOCKET_EVENTS } from './use-chat-socket';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4545';

type PublicMessage = {
  id: string;
  sender_type: string;
  sender_name: string | null;
  content: string;
  created_at: string;
};

export function usePublicChatSocket(
  conversationId: string | null,
  visitorToken: string | null,
  enabled: boolean,
  onMessage: (message: PublicMessage) => void,
  onConnectionChange?: (connected: boolean) => void,
) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;
  const connectionRef = useRef(onConnectionChange);
  connectionRef.current = onConnectionChange;

  useEffect(() => {
    if (!enabled || !conversationId || !visitorToken) {
      connectionRef.current?.(false);
      return;
    }

    const socket: Socket = io(`${API_BASE}/chat`, {
      auth: { visitorToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', () => connectionRef.current?.(true));
    socket.on('disconnect', () => connectionRef.current?.(false));
    socket.on('connect_error', () => connectionRef.current?.(false));

    socket.on(
      CHAT_SOCKET_EVENTS.MESSAGE_NEW,
      (payload: { conversationId: string; message: PublicMessage }) => {
        if (payload.conversationId !== conversationId) return;
        handlerRef.current(payload.message);
      },
    );

    return () => {
      connectionRef.current?.(false);
      socket.disconnect();
    };
  }, [enabled, conversationId, visitorToken]);
}
