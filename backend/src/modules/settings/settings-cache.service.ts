import { Injectable } from '@nestjs/common';

import { SETTINGS_CACHE_TTL_MS } from './settings.constants';

type CacheEntry = { value: unknown; expiresAt: number };

/**
 * In-process TTL cache for resolved tenant settings.
 *
 * Settings are read on nearly every public-site render and every authenticated
 * bootstrap, but mutated rarely — an ideal cache target (PERFORMANCE rule). The
 * `wrap` / `invalidate` surface is intentionally Redis-shaped so the backing
 * `Map` can be swapped for a shared Redis client in production with no caller
 * changes. Keys are prefixed with the tenant id so a single tenant's settings
 * can be invalidated on write.
 */
@Injectable()
export class SettingsCacheService {
  private readonly store = new Map<string, CacheEntry>();

  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = SETTINGS_CACHE_TTL_MS,
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

  /** Invalidate everything, or every key for a tenant prefix. */
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
