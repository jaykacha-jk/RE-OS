import { Injectable } from '@nestjs/common';

import { ANALYTICS_CACHE_TTL_MS } from './analytics.constants';

type CacheEntry = { value: unknown; expiresAt: number };

/**
 * Lightweight in-process TTL cache for analytics aggregations.
 *
 * Analytics queries are read-heavy and tolerant of small staleness, so a short
 * TTL dramatically cuts repeated aggregate scans and keeps the dashboard under
 * the 2s budget. The interface (`wrap` / `invalidate`) is intentionally
 * Redis-shaped: swapping the backing `Map` for a Redis client in production is a
 * drop-in change with no caller modifications (PERFORMANCE / SaaS rules).
 */
@Injectable()
export class AnalyticsCacheService {
  private readonly store = new Map<string, CacheEntry>();

  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = ANALYTICS_CACHE_TTL_MS,
  ): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) {
      return hit.value as T;
    }
    const value = await fn();
    this.store.set(key, { value, expiresAt: now + ttlMs });
    return value;
  }

  /** Invalidate everything (or by key prefix, e.g. a tenant id). */
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
