import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { importSPKI, jwtVerify } from 'jose';
import type { Server, Socket } from 'socket.io';

import { getJwtPublicKeyPem } from '../../config/jwt-keys';
import { CHAT_FULL_ACCESS_ROLES } from './chat.constants';
import { ChatRepository } from './chat.repository';

type JwtPayload = {
  sub: string;
  tid?: string | null;
  roles?: string[];
};

export const CHAT_EVENTS = {
  MESSAGE_NEW: 'chat:message_new',
  MESSAGE_READ: 'chat:message_read',
  TYPING: 'chat:typing',
  CONVERSATION_ASSIGNED: 'chat:conversation_assigned',
  CONVERSATION_CLOSED: 'chat:conversation_closed',
  CONVERSATION_UPDATED: 'chat:conversation_updated',
  UNREAD_COUNT: 'chat:unread_count',
} as const;

function userRoom(userId: string) {
  return `user:${userId}`;
}
function conversationRoom(conversationId: string) {
  return `conv:${conversationId}`;
}

/**
 * Socket.io gateway for realtime chat. Mirrors the notifications gateway auth
 * handshake (RS256 access token via `handshake.auth.token` / `?token=`).
 *
 * Rooms:
 *  - `user:{id}`  — private per-user room (inbox badges, targeted events).
 *  - `conv:{id}`  — joined on demand after a membership/role check; carries
 *                   live message + typing + read events for the open thread.
 *
 * Tenant isolation: subscription is gated by participant membership or a
 * full-access role within the socket's own tenant.
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:3000',
    ],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly repo: ChatRepository) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) return client.disconnect(true);

      const pem = getJwtPublicKeyPem();
      if (!pem) {
        this.logger.warn('JWT_PUBLIC_KEY not configured; rejecting chat socket.');
        return client.disconnect(true);
      }

      const publicKey = await importSPKI(pem, 'RS256');
      const { payload } = await jwtVerify(token, publicKey, { algorithms: ['RS256'] });
      const jwt = payload as unknown as JwtPayload;
      if (!jwt?.sub) return client.disconnect(true);

      client.data.userId = jwt.sub;
      client.data.tenantId = jwt.tid ?? null;
      client.data.roles = jwt.roles ?? [];
      await client.join(userRoom(jwt.sub));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('conversation:subscribe')
  async onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const conversationId = body?.conversationId;
    const userId = client.data.userId as string | undefined;
    const tenantId = client.data.tenantId as string | undefined;
    const roles = (client.data.roles as string[] | undefined) ?? [];
    if (!conversationId || !userId || !tenantId) return { ok: false };

    const allowed = await this.canAccess(tenantId, conversationId, userId, roles);
    if (!allowed) return { ok: false };

    await client.join(conversationRoom(conversationId));
    return { ok: true };
  }

  @SubscribeMessage('conversation:unsubscribe')
  async onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (body?.conversationId) {
      await client.leave(conversationRoom(body.conversationId));
    }
    return { ok: true };
  }

  @SubscribeMessage('chat:typing')
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string; isTyping?: boolean },
  ) {
    if (!body?.conversationId) return;
    const userId = client.data.userId as string | undefined;
    client.to(conversationRoom(body.conversationId)).emit(CHAT_EVENTS.TYPING, {
      conversationId: body.conversationId,
      userId,
      isTyping: !!body.isTyping,
    });
  }

  private async canAccess(
    tenantId: string,
    conversationId: string,
    userId: string,
    roles: string[],
  ): Promise<boolean> {
    const conversation = await this.repo.findBasicById(tenantId, conversationId);
    if (!conversation) return false;
    if (roles.some((r) => CHAT_FULL_ACCESS_ROLES.includes(r))) return true;
    const participant = await this.repo.findParticipant(conversationId, userId);
    if (participant) return true;
    // Assignee (by employee → user) may not yet be a participant row.
    if (conversation.assigned_employee?.user_id === userId) return true;
    return false;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken.replace(/^Bearer\s+/i, '');
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') return queryToken;
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return null;
  }

  // ---- Emit helpers (called by ChatService) --------------------------------

  emitMessage(input: {
    conversationId: string;
    recipientUserIds: string[];
    message: unknown;
  }) {
    this.safeEmit(conversationRoom(input.conversationId), CHAT_EVENTS.MESSAGE_NEW, {
      conversationId: input.conversationId,
      message: input.message,
    });
    for (const uid of input.recipientUserIds) {
      this.safeEmit(userRoom(uid), CHAT_EVENTS.MESSAGE_NEW, {
        conversationId: input.conversationId,
        message: input.message,
      });
    }
  }

  emitRead(input: { conversationId: string; userId: string; readerUserIds: string[] }) {
    const payload = { conversationId: input.conversationId, userId: input.userId };
    this.safeEmit(conversationRoom(input.conversationId), CHAT_EVENTS.MESSAGE_READ, payload);
    for (const uid of input.readerUserIds) {
      this.safeEmit(userRoom(uid), CHAT_EVENTS.MESSAGE_READ, payload);
    }
  }

  emitAssigned(input: { conversationId: string; recipientUserIds: string[]; payload: unknown }) {
    this.safeEmit(
      conversationRoom(input.conversationId),
      CHAT_EVENTS.CONVERSATION_ASSIGNED,
      input.payload,
    );
    for (const uid of input.recipientUserIds) {
      this.safeEmit(userRoom(uid), CHAT_EVENTS.CONVERSATION_ASSIGNED, input.payload);
    }
  }

  emitClosed(input: { conversationId: string; recipientUserIds: string[]; payload: unknown }) {
    this.safeEmit(
      conversationRoom(input.conversationId),
      CHAT_EVENTS.CONVERSATION_CLOSED,
      input.payload,
    );
    for (const uid of input.recipientUserIds) {
      this.safeEmit(userRoom(uid), CHAT_EVENTS.CONVERSATION_CLOSED, input.payload);
    }
  }

  emitConversationUpdated(input: { conversationId: string; recipientUserIds: string[]; payload: unknown }) {
    this.safeEmit(
      conversationRoom(input.conversationId),
      CHAT_EVENTS.CONVERSATION_UPDATED,
      input.payload,
    );
    for (const uid of input.recipientUserIds) {
      this.safeEmit(userRoom(uid), CHAT_EVENTS.CONVERSATION_UPDATED, input.payload);
    }
  }

  emitUnreadCount(userId: string, count: number) {
    this.safeEmit(userRoom(userId), CHAT_EVENTS.UNREAD_COUNT, { count });
  }

  private safeEmit(room: string, event: string, payload: unknown) {
    try {
      this.server?.to(room).emit(event, payload);
    } catch (err) {
      this.logger.error(
        `Chat realtime emit failed event=${event}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
