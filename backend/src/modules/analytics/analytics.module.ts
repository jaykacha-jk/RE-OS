import { Module } from '@nestjs/common';

import { FeatureFlagsModule } from '../../common/feature-flags.module';
import { AnalyticsCacheService } from './analytics-cache.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { PlatformAnalyticsController } from './platform-analytics.controller';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [AnalyticsController, PlatformAnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository, AnalyticsCacheService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
