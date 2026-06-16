import { Injectable } from '@nestjs/common';

import { RedisTtlCacheService } from '../../common/cache/redis-ttl-cache.service';
import { ANALYTICS_CACHE_TTL_MS } from './analytics.constants';

/** Analytics aggregation cache: Redis in production, memory in dev/test. */
@Injectable()
export class AnalyticsCacheService extends RedisTtlCacheService {
  constructor() {
    super('analytics-cache', ANALYTICS_CACHE_TTL_MS);
  }
}
