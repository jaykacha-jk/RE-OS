import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { PublicAnalyticsCacheService } from './public-analytics-cache.service';
import { PublicAnalyticsRepository } from './public-analytics.repository';
import { TOP_LIST_LIMIT } from './public-analytics.constants';
import { TrackEventDto } from './dto/track-event.dto';
import { PublicAnalyticsQueryDto } from './dto/public-analytics-query.dto';

type TrackMeta = { ipAddress?: string; userAgent?: string };

@Injectable()
export class PublicAnalyticsService {
  constructor(
    private readonly repo: PublicAnalyticsRepository,
    private readonly cache: PublicAnalyticsCacheService,
  ) {}

  /** Privacy-preserving IP hash — we never store raw visitor IPs. */
  private hashIp(ip?: string): string | null {
    if (!ip) return null;
    return createHash('sha256').update(ip).digest('hex').slice(0, 32);
  }

  /** Records a public website event. Tenant is resolved from its slug. */
  async track(dto: TrackEventDto, meta?: TrackMeta) {
    const org = await this.repo.findOrganizationBySlug(dto.tenant);
    if (!org || org.status === 'suspended') {
      // Don't leak tenant existence; silently accept (no-op) for unknown sites.
      return { accepted: false };
    }

    await this.repo.createEvent({
      tenantId: org.id,
      eventType: dto.event_type,
      entityType: dto.entity_type,
      entityId: dto.entity_id,
      path: dto.path,
      referrer: dto.referrer,
      source: dto.source,
      sessionId: dto.session_id,
      userAgent: meta?.userAgent,
      ipHash: this.hashIp(meta?.ipAddress),
    });

    this.cache.invalidate(`public-analytics:${org.id}:`);
    return { accepted: true };
  }

  // ---------------------------------------------------------------------------
  // Read side (authenticated dashboard).
  // ---------------------------------------------------------------------------

  resolveRange(query: PublicAnalyticsQueryDto): { from: Date; to: Date; range: string } {
    const to = new Date();
    const range = query.range ?? '30d';

    if (range === 'custom' && query.date_from && query.date_to) {
      return { from: new Date(query.date_from), to: new Date(query.date_to), range };
    }
    if (range === 'today') {
      const from = new Date(to);
      from.setHours(0, 0, 0, 0);
      return { from, to, range };
    }
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const from = new Date(to.getTime() - days * 86_400_000);
    return { from, to, range: range === 'custom' ? '30d' : range };
  }

  private rate(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  }

  async getPublicDashboard(tenantId: string, query: PublicAnalyticsQueryDto) {
    const { from, to, range } = this.resolveRange(query);
    const key = `public-analytics:${tenantId}:${range}:${from.getTime()}:${to.getTime()}`;

    return this.cache.wrap(key, async () => {
      const [byType, topPaths, sources, referrers, topProps] = await Promise.all([
        this.repo.countByType(tenantId, from, to),
        this.repo.topPaths(tenantId, from, to, TOP_LIST_LIMIT),
        this.repo.bySource(tenantId, from, to, TOP_LIST_LIMIT),
        this.repo.topReferrers(tenantId, from, to, TOP_LIST_LIMIT),
        this.repo.topProperties(tenantId, from, to, TOP_LIST_LIMIT),
      ]);

      const counts: Record<string, number> = {};
      for (const r of byType) counts[r.event_type] = r._count._all;

      const propertyViews = counts.property_view ?? 0;
      const propertyClicks = counts.property_click ?? 0;
      const inquiryConversions = counts.inquiry_conversion ?? 0;
      const chatConversions = counts.chat_conversion ?? 0;
      const pageViews = counts.page_view ?? 0;

      return {
        range,
        date_from: from.toISOString(),
        date_to: to.toISOString(),
        totals: {
          page_views: pageViews,
          property_views: propertyViews,
          property_clicks: propertyClicks,
          inquiry_conversions: inquiryConversions,
          chat_conversions: chatConversions,
        },
        conversion: {
          // Inquiries / chats raised relative to property views (intent signal).
          inquiry_conversion_rate: this.rate(inquiryConversions, propertyViews),
          chat_conversion_rate: this.rate(chatConversions, propertyViews),
          click_through_rate: this.rate(propertyClicks, propertyViews),
        },
        top_pages: topPaths.map((r) => ({ path: r.path, views: r._count._all })),
        top_properties: topProps.map((r) => ({ entity_id: r.entity_id, views: r._count._all })),
        traffic_sources: sources.map((r) => ({ source: r.source ?? 'direct', count: r._count._all })),
        referrers: referrers.map((r) => ({ referrer: r.referrer, count: r._count._all })),
        generated_at: new Date().toISOString(),
      };
    });
  }
}
