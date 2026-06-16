import { Injectable } from '@nestjs/common';

import { RedisTtlCacheService } from '../../common/cache/redis-ttl-cache.service';
import { SETTINGS_CACHE_TTL_MS } from './settings.constants';

/** Tenant settings cache: Redis in production, memory in dev/test. */
@Injectable()
export class SettingsCacheService extends RedisTtlCacheService {
  constructor() {
    super('settings-cache', SETTINGS_CACHE_TTL_MS);
  }
}
