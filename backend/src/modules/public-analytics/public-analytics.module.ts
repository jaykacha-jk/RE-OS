import { Module } from '@nestjs/common';

import { PublicAnalyticsCacheService } from './public-analytics-cache.service';
import { PublicAnalyticsController } from './public-analytics.controller';
import { PublicAnalyticsRepository } from './public-analytics.repository';
import { PublicAnalyticsService } from './public-analytics.service';
import { PublicAnalyticsTrackController } from './public-analytics-track.controller';

/**
 * Phase 9 — Public website analytics. Ingests anonymous events from tenant
 * sites (views, clicks, conversions) and serves aggregated dashboards to
 * authenticated staff. Exports the service for cross-module conversion tagging.
 */
@Module({
  controllers: [PublicAnalyticsController, PublicAnalyticsTrackController],
  providers: [PublicAnalyticsService, PublicAnalyticsRepository, PublicAnalyticsCacheService],
  exports: [PublicAnalyticsService],
})
export class PublicAnalyticsModule {}
