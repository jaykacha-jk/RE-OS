import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';

type CacheEntry = { value: unknown; expiresAt: number };
type RedisCtor = new (...args: unknown[]) => Redis;

type CacheDriver = 'redis' | 'memory';

/**
 * Small Redis-backed TTL cache with an in-memory dev/test fallback.
 *
 * Production must provide Redis (`REDIS_URL` or `REDIS_HOST`). Local dev and
 * tests keep using memory so the app remains easy to run without infrastructure.
 */
export abstract class RedisTtlCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;
  private readonly store = new Map<string, CacheEntry>();
  private readonly driver: CacheDriver;
  private redis: Redis | null = null;
  private connectPromise: Promise<void> | null = null;

  protected constructor(
    private readonly namespace: string,
    private readonly defaultTtlMs: number,
  ) {
    this.logger = new Logger(namespace);

    const redisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
    const redisDisabledInTests =
      process.env.NODE_ENV === 'test' && process.env.ENABLE_REDIS_CACHE_IN_TEST !== 'true';

    if (!redisConfigured || redisDisabledInTests) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`${namespace} requires REDIS_URL or REDIS_HOST in production`);
      }
      this.driver = 'memory';
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const imported = require('ioredis') as { default?: RedisCtor } | RedisCtor;
      const RedisClient: RedisCtor = (
        'default' in imported && imported.default ? imported.default : imported
      ) as RedisCtor;
      this.redis = process.env.REDIS_URL
        ? new RedisClient(process.env.REDIS_URL, this.redisOptions())
        : new RedisClient({
            host: process.env.REDIS_HOST ?? '127.0.0.1',
            port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
            ...(process.env.REDIS_PASSWORD
              ? { password: process.env.REDIS_PASSWORD }
              : {}),
            ...this.redisOptions(),
          });
      this.driver = 'redis';
      this.logger.log(`${namespace} using Redis cache.`);
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `${namespace} Redis cache initialization failed in production: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      this.driver = 'memory';
      this.logger.warn(
        `${namespace} Redis cache unavailable; falling back to in-memory cache.`,
      );
    }
  }

  get activeDriver(): CacheDriver {
    return this.driver;
  }

  async onModuleInit() {
    if (this.driver !== 'redis') return;
    try {
      await this.ensureConnected();
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `${this.namespace} Redis cache connection failed in production: ${this.err(err)}`,
        );
      }
      this.logger.warn(`Redis cache connection failed: ${this.err(err)}`);
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = this.defaultTtlMs,
  ): Promise<T> {
    const cacheKey = this.key(key);
    const cached = await this.get<T>(cacheKey);
    if (cached.hit) return cached.value;

    const value = await fn();
    await this.set(cacheKey, value, ttlMs);
    return value;
  }

  /** Invalidate everything in this namespace, or every key with the given prefix. */
  async invalidate(prefix?: string): Promise<void> {
    const cachePrefix = prefix ? this.key(prefix) : `${this.namespace}:`;

    if (this.driver !== 'redis') {
      if (!prefix) {
        this.store.clear();
        return;
      }
      for (const key of this.store.keys()) {
        if (key.startsWith(cachePrefix)) this.store.delete(key);
      }
      return;
    }

    await this.deleteByPrefix(cachePrefix);
  }

  private redisOptions() {
    return {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    } as const;
  }

  private key(key: string) {
    return `${this.namespace}:${key}`;
  }

  private async get<T>(key: string): Promise<{ hit: true; value: T } | { hit: false }> {
    if (this.driver === 'redis' && this.redis) {
      try {
        await this.ensureConnected();
        const raw = await this.redis.get(key);
        if (raw === null) return { hit: false };
        return { hit: true, value: JSON.parse(raw) as T };
      } catch (err) {
        this.logger.warn(`Redis cache read failed: ${this.err(err)}`);
        return { hit: false };
      }
    }

    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) return { hit: true, value: hit.value as T };
    if (hit) this.store.delete(key);
    return { hit: false };
  }

  private async set(key: string, value: unknown, ttlMs: number) {
    if (this.driver === 'redis' && this.redis) {
      try {
        await this.ensureConnected();
        await this.redis.set(key, JSON.stringify(value), 'PX', ttlMs);
      } catch (err) {
        this.logger.warn(`Redis cache write failed: ${this.err(err)}`);
      }
      return;
    }

    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private async deleteByPrefix(prefix: string) {
    if (!this.redis) return;
    try {
      await this.ensureConnected();
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = next;
        if (keys.length) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`Redis cache invalidate failed: ${this.err(err)}`);
    }
  }

  private async ensureConnected() {
    if (!this.redis || this.redis.status === 'ready') return;
    if (!this.connectPromise) {
      this.connectPromise = this.redis.connect().then(() => undefined).finally(() => {
        this.connectPromise = null;
      });
    }
    await this.connectPromise;
  }

  private err(err: unknown) {
    return err instanceof Error ? err.message : String(err);
  }
}
