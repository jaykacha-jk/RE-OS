import { Injectable } from '@nestjs/common';

import { RedisTtlCacheService } from '../../common/cache/redis-ttl-cache.service';
import { PUBLIC_ANALYTICS_CACHE_TTL_MS } from './public-analytics.constants';

/** Public analytics aggregation cache: Redis in production, memory in dev/test. */
@Injectable()
export class PublicAnalyticsCacheService extends RedisTtlCacheService {
  constructor() {
    super('public-analytics-cache', PUBLIC_ANALYTICS_CACHE_TTL_MS);
  }
}
