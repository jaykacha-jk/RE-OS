import { Injectable } from '@nestjs/common';

import { PUBLIC_ANALYTICS_CACHE_TTL_MS } from './public-analytics.constants';

type CacheEntry = { value: unknown; expiresAt: number };

/** Redis-shaped in-process TTL cache for public-analytics aggregations. */
@Injectable()
export class PublicAnalyticsCacheService {
  private readonly store = new Map<string, CacheEntry>();

  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = PUBLIC_ANALYTICS_CACHE_TTL_MS,
  ): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) return hit.value as T;
    const value = await fn();
    this.store.set(key, { value, expiresAt: now + ttlMs });
    return value;
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
