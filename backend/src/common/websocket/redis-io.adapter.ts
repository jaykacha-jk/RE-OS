import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';

/**
 * Socket.io Redis adapter for multi-instance realtime (chat + notifications).
 * No-op when REDIS_URL / REDIS_HOST is not configured.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connect(): Promise<void> {
    const url = process.env.REDIS_URL?.trim();
    const host = process.env.REDIS_HOST?.trim();
    if (!url && !host) {
      this.logger.log('Redis not configured; Socket.io using in-memory adapter.');
      return;
    }

    const pubClient = url
      ? new Redis(url, { maxRetriesPerRequest: null })
      : new Redis({
          host: host ?? '127.0.0.1',
          port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: null,
        });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) =>
      this.logger.error(`Socket.io Redis pub error: ${err.message}`),
    );
    subClient.on('error', (err) =>
      this.logger.error(`Socket.io Redis sub error: ${err.message}`),
    );

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Socket.io Redis adapter enabled.');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
