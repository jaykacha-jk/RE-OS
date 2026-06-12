import { PublicAnalyticsCacheService } from './public-analytics-cache.service';
import { PublicAnalyticsRepository } from './public-analytics.repository';
import { PublicAnalyticsService } from './public-analytics.service';

function build() {
  const repo: jest.Mocked<Partial<PublicAnalyticsRepository>> = {
    findOrganizationBySlug: jest.fn(),
    createEvent: jest.fn().mockResolvedValue(undefined),
    countByType: jest.fn().mockResolvedValue([]),
    topPaths: jest.fn().mockResolvedValue([]),
    bySource: jest.fn().mockResolvedValue([]),
    topReferrers: jest.fn().mockResolvedValue([]),
    topProperties: jest.fn().mockResolvedValue([]),
  };
  const cache = {
    wrap: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    invalidate: jest.fn(),
  } as unknown as PublicAnalyticsCacheService;
  return { service: new PublicAnalyticsService(repo as unknown as PublicAnalyticsRepository, cache), repo, cache };
}

describe('PublicAnalyticsService', () => {
  describe('track', () => {
    it('hashes the visitor IP and never stores it raw', async () => {
      const { service, repo } = build();
      repo.findOrganizationBySlug!.mockResolvedValue({ id: 'tenant-1', status: 'active' } as never);

      await service.track(
        { tenant: 'demo', event_type: 'property_view', entity_id: 'p1' } as never,
        { ipAddress: '1.2.3.4', userAgent: 'ua' },
      );

      const arg = repo.createEvent!.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.tenantId).toBe('tenant-1');
      expect(arg.ipHash).toBeDefined();
      expect(arg.ipHash).not.toBe('1.2.3.4');
      expect(String(arg.ipHash)).toHaveLength(32);
    });

    it('silently no-ops for unknown/suspended tenants (no leak)', async () => {
      const { service, repo } = build();
      repo.findOrganizationBySlug!.mockResolvedValue(null as never);
      const res = await service.track({ tenant: 'nope', event_type: 'page_view' } as never);
      expect(res).toEqual({ accepted: false });
      expect(repo.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('resolveRange', () => {
    it('defaults to a 30-day window', () => {
      const { service } = build();
      const r = service.resolveRange({});
      expect(r.range).toBe('30d');
      const days = Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000);
      expect(days).toBe(30);
    });

    it('honours custom dates', () => {
      const { service } = build();
      const r = service.resolveRange({ range: 'custom', date_from: '2026-01-01', date_to: '2026-02-01' });
      expect(r.from.toISOString().slice(0, 10)).toBe('2026-01-01');
      expect(r.to.toISOString().slice(0, 10)).toBe('2026-02-01');
    });
  });

  describe('getPublicDashboard', () => {
    it('computes conversion rates from event-type counts', async () => {
      const { service, repo } = build();
      repo.countByType!.mockResolvedValue([
        { event_type: 'property_view', _count: { _all: 200 } },
        { event_type: 'property_click', _count: { _all: 50 } },
        { event_type: 'inquiry_conversion', _count: { _all: 20 } },
        { event_type: 'chat_conversion', _count: { _all: 10 } },
        { event_type: 'page_view', _count: { _all: 500 } },
      ] as never);

      const res = (await service.getPublicDashboard('tenant-1', {})) as any;
      expect(res.totals.property_views).toBe(200);
      expect(res.totals.page_views).toBe(500);
      // 20 / 200 = 10%, 10 / 200 = 5%, 50 / 200 = 25%
      expect(res.conversion.inquiry_conversion_rate).toBe(10);
      expect(res.conversion.chat_conversion_rate).toBe(5);
      expect(res.conversion.click_through_rate).toBe(25);
    });

    it('returns 0 conversion when there are no property views', async () => {
      const { service } = build();
      const res = (await service.getPublicDashboard('tenant-1', {})) as any;
      expect(res.conversion.inquiry_conversion_rate).toBe(0);
      expect(res.totals.property_views).toBe(0);
    });

    it('maps top pages, sources and referrers', async () => {
      const { service, repo } = build();
      repo.topPaths!.mockResolvedValue([{ path: '/listings', _count: { _all: 80 } }] as never);
      repo.bySource!.mockResolvedValue([{ source: 'google', _count: { _all: 120 } }] as never);
      repo.topReferrers!.mockResolvedValue([
        { referrer: 'https://google.com', _count: { _all: 40 } },
      ] as never);

      const res = (await service.getPublicDashboard('tenant-1', {})) as any;
      expect(res.top_pages[0]).toEqual({ path: '/listings', views: 80 });
      expect(res.traffic_sources[0]).toEqual({ source: 'google', count: 120 });
      expect(res.referrers[0]).toEqual({ referrer: 'https://google.com', count: 40 });
    });
  });
});
