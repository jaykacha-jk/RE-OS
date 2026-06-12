import { Module } from '@nestjs/common';

import { AnalyticsCacheService } from './analytics-cache.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { PlatformAnalyticsController } from './platform-analytics.controller';

@Module({
  controllers: [AnalyticsController, PlatformAnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository, AnalyticsCacheService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
