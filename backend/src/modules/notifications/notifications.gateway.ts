import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { importSPKI, jwtVerify } from 'jose';
import type { Server, Socket } from 'socket.io';

import { getJwtPublicKeyPem } from '../../config/jwt-keys';

type JwtPayload = {
  sub: string;
  tid?: string | null;
  roles?: string[];
};

export const NOTIFICATION_EVENTS = {
  RECEIVED: 'notification:received',
  UNREAD_COUNT: 'notification:unread_count',
  READ: 'notification:read',
} as const;

function userRoom(userId: string) {
  return `user:${userId}`;
}

/**
 * Socket.io gateway for realtime notification delivery.
 *
 * Auth: clients pass their access token via `handshake.auth.token` (or
 * `?token=`); it is verified with the same RS256 public key as the HTTP guard.
 * Each socket joins a private `user:{id}` room (tenant isolation by
 * construction — a user only ever receives events targeted at their own room),
 * and Super Admins additionally join the `platform` room.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:3000',
    ],
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const pem = getJwtPublicKeyPem();
      if (!pem) {
        this.logger.warn('JWT_PUBLIC_KEY not configured; rejecting socket.');
        client.disconnect(true);
        return;
      }

      const publicKey = await importSPKI(pem, 'RS256');
      const { payload } = await jwtVerify(token, publicKey, {
        algorithms: ['RS256'],
      });
      const jwt = payload as unknown as JwtPayload;
      if (!jwt?.sub) {
        client.disconnect(true);
        return;
      }

      client.data.userId = jwt.sub;
      client.data.tenantId = jwt.tid ?? null;
      await client.join(userRoom(jwt.sub));
      if (jwt.roles?.includes('super_admin')) {
        await client.join('platform');
      }
    } catch {
      client.disconnect(true);
    }
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

  // ---- Emit helpers (called by the dispatcher) -----------------------------

  emitNotification(userId: string, notification: unknown) {
    this.safeEmit(userRoom(userId), NOTIFICATION_EVENTS.RECEIVED, notification);
  }

  emitUnreadCount(userId: string, count: number) {
    this.safeEmit(userRoom(userId), NOTIFICATION_EVENTS.UNREAD_COUNT, { count });
  }

  emitRead(userId: string, payload: { id?: string; all?: boolean; unread_count: number }) {
    this.safeEmit(userRoom(userId), NOTIFICATION_EVENTS.READ, payload);
  }

  private safeEmit(room: string, event: string, payload: unknown) {
    try {
      this.server?.to(room).emit(event, payload);
    } catch (err) {
      this.logger.error(
        `Realtime emit failed event=${event}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
