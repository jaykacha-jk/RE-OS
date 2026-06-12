import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class PublicAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrganizationBySlug(slug: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { slug, deleted_at: null },
      select: { id: true, status: true },
    });
  }

  async createEvent(input: {
    tenantId: string;
    eventType: string;
    entityType?: string | null;
    entityId?: string | null;
    path?: string | null;
    referrer?: string | null;
    source?: string | null;
    sessionId?: string | null;
    userAgent?: string | null;
    ipHash?: string | null;
  }) {
    return this.prisma.dbClient.public_analytics_events.create({
      data: {
        tenant_id: input.tenantId,
        event_type: input.eventType,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        path: input.path ?? null,
        referrer: input.referrer ?? null,
        source: input.source ?? null,
        session_id: input.sessionId ?? null,
        user_agent: input.userAgent ?? null,
        ip_hash: input.ipHash ?? null,
      },
    });
  }

  private range(tenantId: string, from: Date, to: Date): Prisma.public_analytics_eventsWhereInput {
    return { tenant_id: tenantId, created_at: { gte: from, lte: to } };
  }

  /** Count per event_type for the window. */
  async countByType(tenantId: string, from: Date, to: Date) {
    return this.prisma.dbClient.public_analytics_events.groupBy({
      by: ['event_type'],
      where: this.range(tenantId, from, to),
      _count: { _all: true },
    });
  }

  /** Top paths by view volume. */
  async topPaths(tenantId: string, from: Date, to: Date, limit: number) {
    return this.prisma.dbClient.public_analytics_events.groupBy({
      by: ['path'],
      where: { ...this.range(tenantId, from, to), event_type: 'page_view', path: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { path: 'desc' } },
      take: limit,
    });
  }

  /** Traffic split by source/channel. */
  async bySource(tenantId: string, from: Date, to: Date, limit: number) {
    return this.prisma.dbClient.public_analytics_events.groupBy({
      by: ['source'],
      where: this.range(tenantId, from, to),
      _count: { _all: true },
      orderBy: { _count: { source: 'desc' } },
      take: limit,
    });
  }

  /** Top referrers. */
  async topReferrers(tenantId: string, from: Date, to: Date, limit: number) {
    return this.prisma.dbClient.public_analytics_events.groupBy({
      by: ['referrer'],
      where: { ...this.range(tenantId, from, to), referrer: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referrer: 'desc' } },
      take: limit,
    });
  }

  /** Most-viewed entities (e.g. properties) for property_view events. */
  async topProperties(tenantId: string, from: Date, to: Date, limit: number) {
    return this.prisma.dbClient.public_analytics_events.groupBy({
      by: ['entity_id'],
      where: {
        ...this.range(tenantId, from, to),
        event_type: 'property_view',
        entity_id: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { entity_id: 'desc' } },
      take: limit,
    });
  }
}
