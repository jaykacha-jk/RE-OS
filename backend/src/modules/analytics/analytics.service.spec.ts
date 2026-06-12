import type { AuthUser } from '../../common/context/auth-user';
import { AnalyticsCacheService } from './analytics-cache.service';
import { AnalyticsRepository, type AnalyticsScope } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

const TENANT = 'tenant-1';

function makeUser(roles: string[], userId = 'user-1'): AuthUser {
  return { userId, tenantId: TENANT, roles, permissions: ['analytics.read'] } as AuthUser;
}

function stageCount(stage: string, count: number) {
  return { stage, _count: { _all: count } };
}

function buildService() {
  const repo: jest.Mocked<Partial<AnalyticsRepository>> = {
    findEmployeeByUserId: jest.fn(),
    findSubordinateEmployeeIds: jest.fn(),
    employeeNames: jest.fn().mockResolvedValue(new Map()),
    countEmployees: jest.fn().mockResolvedValue(3),
    buildInquiryWhere: jest.fn((tenantId, scope) => ({ tenant_id: tenantId, _scope: scope })) as any,
    buildSiteVisitWhere: jest.fn((tenantId) => ({ tenant_id: tenantId })) as any,
    buildPropertyWhere: jest.fn((tenantId) => ({ tenant_id: tenantId })) as any,
    stageCounts: jest.fn().mockResolvedValue([]),
    countInquiries: jest.fn().mockResolvedValue(0),
    countSiteVisits: jest.fn().mockResolvedValue(0),
    sourceCounts: jest.fn().mockResolvedValue([]),
    wonDeals: jest.fn().mockResolvedValue([]),
    propertyStatusCounts: jest.fn().mockResolvedValue([]),
    countActiveProperties: jest.fn().mockResolvedValue(0),
    employeePerformance: jest.fn().mockResolvedValue([]),
    monthlyLeads: jest.fn().mockResolvedValue([]),
    monthlyConversion: jest.fn().mockResolvedValue([]),
    organizationStatusCounts: jest.fn().mockResolvedValue([]),
    organizationTierCounts: jest.fn().mockResolvedValue([]),
    countAllUsers: jest.fn().mockResolvedValue(0),
    countAllProperties: jest.fn().mockResolvedValue(0),
    countAllInquiries: jest.fn().mockResolvedValue(0),
    activePlans: jest.fn().mockResolvedValue([]),
    monthlyOrgGrowth: jest.fn().mockResolvedValue([]),
  };

  // Pass-through cache so every call exercises the real aggregation logic.
  const cache = {
    wrap: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    invalidate: jest.fn(),
  } as unknown as AnalyticsCacheService;

  const service = new AnalyticsService(
    repo as unknown as AnalyticsRepository,
    cache,
  );
  return { service, repo };
}

describe('AnalyticsService', () => {
  // ===========================================================================
  // RBAC scope resolution
  // ===========================================================================
  describe('resolveScope (RBAC visibility)', () => {
    it('org owner / admin get org-wide scope', async () => {
      const { service, repo } = buildService();
      for (const role of ['super_admin', 'org_owner', 'org_admin']) {
        const scope = await service.resolveScope(makeUser([role]), TENANT);
        expect(scope).toEqual({ type: 'all' });
      }
      expect(repo.findEmployeeByUserId).not.toHaveBeenCalled();
    });

    it('sales manager gets team scope (self + direct reports)', async () => {
      const { service, repo } = buildService();
      repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-mgr' } as any);
      repo.findSubordinateEmployeeIds!.mockResolvedValue(['emp-a', 'emp-b']);
      const scope = await service.resolveScope(makeUser(['sales_manager']), TENANT);
      expect(scope).toEqual({ type: 'employees', employeeIds: ['emp-mgr', 'emp-a', 'emp-b'] });
    });

    it('sales executive / telecaller get assigned-only scope (self)', async () => {
      const { service, repo } = buildService();
      repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-self' } as any);
      const exec = await service.resolveScope(makeUser(['sales_executive']), TENANT);
      expect(exec).toEqual({ type: 'employees', employeeIds: ['emp-self'] });
      const tele = await service.resolveScope(makeUser(['telecaller']), TENANT);
      expect(tele).toEqual({ type: 'employees', employeeIds: ['emp-self'] });
    });

    it('falls back to an empty (matches nothing) scope when no employee record', async () => {
      const { service, repo } = buildService();
      repo.findEmployeeByUserId!.mockResolvedValue(null);
      const scope = await service.resolveScope(makeUser(['sales_executive']), TENANT);
      expect(scope).toEqual({ type: 'employees', employeeIds: [] });
    });
  });

  // ===========================================================================
  // Time range resolution
  // ===========================================================================
  describe('resolveRange (time filters)', () => {
    it('defaults to 30 days', () => {
      const { service } = buildService();
      const r = service.resolveRange({});
      expect(r.range).toBe('30d');
      const diffDays = Math.round((r.to!.getTime() - r.from!.getTime()) / 86_400_000);
      expect(diffDays).toBe(30);
    });

    it('today resolves to start-of-day → now', () => {
      const { service } = buildService();
      const r = service.resolveRange({ range: 'today' });
      expect(r.from!.getHours()).toBe(0);
      expect(r.from!.getMinutes()).toBe(0);
    });

    it('7d and 90d resolve to the right windows', () => {
      const { service } = buildService();
      expect(Math.round((service.resolveRange({ range: '7d' }).to!.getTime() - service.resolveRange({ range: '7d' }).from!.getTime()) / 86_400_000)).toBe(7);
      expect(Math.round((service.resolveRange({ range: '90d' }).to!.getTime() - service.resolveRange({ range: '90d' }).from!.getTime()) / 86_400_000)).toBe(90);
    });

    it('custom uses provided dates', () => {
      const { service } = buildService();
      const r = service.resolveRange({ range: 'custom', date_from: '2026-01-01', date_to: '2026-02-01' });
      expect(r.from!.toISOString().slice(0, 10)).toBe('2026-01-01');
      expect(r.to!.toISOString().slice(0, 10)).toBe('2026-02-01');
    });
  });

  // ===========================================================================
  // Lead KPIs / conversion math
  // ===========================================================================
  describe('getLeads', () => {
    it('computes qualified, won, lost and conversion rate', async () => {
      const { service, repo } = buildService();
      repo.countInquiries!.mockResolvedValue(100);
      repo.countSiteVisits!.mockResolvedValue(12);
      repo.stageCounts!.mockResolvedValue([
        stageCount('NEW', 40),
        stageCount('CONTACTED', 20),
        stageCount('QUALIFIED', 15),
        stageCount('SITE_VISIT_SCHEDULED', 5),
        stageCount('NEGOTIATION', 5),
        stageCount('CLOSED_WON', 10),
        stageCount('CLOSED_LOST', 5),
      ] as any);

      const res = await service.getLeads(TENANT, makeUser(['org_admin']), {} as any) as any;
      expect(res.total).toBe(100);
      expect(res.new).toBe(40);
      expect(res.won).toBe(10);
      expect(res.lost).toBe(5);
      // qualified+ = 15 + 5 + 5 + 10 = 35
      expect(res.qualified).toBe(35);
      expect(res.conversion_rate).toBe(10); // 10/100 * 100
    });

    it('returns 0 conversion when there are no leads', async () => {
      const { service } = buildService();
      const res = (await service.getLeads(TENANT, makeUser(['org_admin']), {} as any)) as any;
      expect(res.total).toBe(0);
      expect(res.conversion_rate).toBe(0);
    });
  });

  // ===========================================================================
  // Property KPIs
  // ===========================================================================
  describe('getProperties', () => {
    it('aggregates status counts into a snapshot', async () => {
      const { service, repo } = buildService();
      repo.propertyStatusCounts!.mockResolvedValue([
        { status: 'published', _count: { _all: 8 } },
        { status: 'reserved', _count: { _all: 2 } },
        { status: 'sold', _count: { _all: 3 } },
        { status: 'draft', _count: { _all: 4 } },
      ] as any);
      repo.countActiveProperties!.mockResolvedValue(10);

      const res = (await service.getProperties(TENANT, makeUser(['org_owner']))) as any;
      expect(res.total).toBe(17);
      expect(res.published).toBe(8);
      expect(res.reserved).toBe(2);
      expect(res.sold).toBe(3);
      expect(res.active).toBe(10);
    });
  });

  // ===========================================================================
  // Funnel
  // ===========================================================================
  describe('getFunnel', () => {
    it('is monotonically non-increasing (stage-or-beyond)', async () => {
      const { service, repo } = buildService();
      repo.stageCounts!.mockResolvedValue([
        stageCount('NEW', 50),
        stageCount('CONTACTED', 30),
        stageCount('QUALIFIED', 20),
        stageCount('SITE_VISIT_SCHEDULED', 10),
        stageCount('NEGOTIATION', 5),
        stageCount('CLOSED_WON', 3),
        stageCount('CLOSED_LOST', 8),
      ] as any);

      const res = (await service.getFunnel(TENANT, makeUser(['org_admin']), {} as any)) as any;
      const counts = res.funnel.map((f: { count: number }) => f.count);
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
      }
      // "New or beyond" includes everyone on the happy path (excludes lost).
      expect(counts[0]).toBe(50 + 30 + 20 + 10 + 5 + 3);
      // "Won" bucket = only won.
      expect(counts[counts.length - 1]).toBe(3);
    });
  });

  // ===========================================================================
  // Sources
  // ===========================================================================
  describe('getSources', () => {
    it('maps + sorts source counts and coalesces nulls to Unknown', async () => {
      const { service, repo } = buildService();
      repo.sourceCounts!.mockResolvedValue([
        { source_name: 'Website', _count: { _all: 5 } },
        { source_name: null, _count: { _all: 2 } },
        { source_name: 'WhatsApp', _count: { _all: 9 } },
      ] as any);
      const res = (await service.getSources(TENANT, makeUser(['org_admin']), {} as any)) as any;
      expect(res.sources[0]).toEqual({ source: 'WhatsApp', count: 9 });
      expect(res.sources.find((s: { source: string }) => s.source === 'Unknown').count).toBe(2);
    });
  });

  // ===========================================================================
  // Revenue
  // ===========================================================================
  describe('getRevenue', () => {
    it('sums property price, falling back to budget_max then budget_min', async () => {
      const { service, repo } = buildService();
      repo.wonDeals!.mockResolvedValue([
        { property: { price: 5_000_000 }, budget_max: 9_000_000, budget_min: 1 },
        { property: null, budget_max: 3_000_000, budget_min: 1 },
        { property: null, budget_max: null, budget_min: 2_000_000 },
      ] as any);
      const res = (await service.getRevenue(TENANT, makeUser(['org_owner']), {} as any)) as any;
      expect(res.won_deals).toBe(3);
      expect(res.won_amount).toBe(10_000_000);
      expect(res.avg_deal_value).toBeCloseTo(3_333_333.33, 1);
      expect(res.currency).toBe('INR');
    });

    it('ranges revenue by close date (closed_at field)', async () => {
      const { service, repo } = buildService();
      await service.getRevenue(TENANT, makeUser(['org_owner']), {} as any);
      expect(repo.buildInquiryWhere).toHaveBeenCalledWith(
        TENANT,
        { type: 'all' },
        expect.anything(),
        { dateField: 'closed_at' },
      );
    });
  });

  // ===========================================================================
  // Dashboard composition + performance-table visibility
  // ===========================================================================
  describe('getDashboard', () => {
    it('hides the employee performance table for assigned-scope roles', async () => {
      const { service, repo } = buildService();
      repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-self' } as any);
      repo.employeePerformance!.mockResolvedValue([
        { employee_id: 'emp-self', total: 5, won: 1, lost: 1, site_visits: 2 },
      ]);

      const res = (await service.getDashboard(TENANT, makeUser(['sales_executive']), {} as any)) as any;
      expect(res.employees).toEqual([]);
      expect(repo.employeePerformance).not.toHaveBeenCalled();
      expect(res.scope).toBe('assigned');
    });

    it('shows the performance table for managers (team scope) with conversion %', async () => {
      const { service, repo } = buildService();
      repo.findEmployeeByUserId!.mockResolvedValue({ id: 'emp-mgr' } as any);
      repo.findSubordinateEmployeeIds!.mockResolvedValue(['emp-a']);
      repo.employeePerformance!.mockResolvedValue([
        { employee_id: 'emp-a', total: 10, won: 4, lost: 2, site_visits: 6 },
        { employee_id: 'emp-mgr', total: 8, won: 2, lost: 1, site_visits: 3 },
      ]);
      repo.employeeNames!.mockResolvedValue(
        new Map([
          ['emp-a', 'Asha Rep'],
          ['emp-mgr', 'Manager Mike'],
        ]),
      );

      const res = (await service.getDashboard(TENANT, makeUser(['sales_manager']), {} as any)) as any;
      expect(res.scope).toBe('team');
      expect(res.employees).toHaveLength(2);
      // Sorted by won desc → Asha first.
      expect(res.employees[0]).toMatchObject({ name: 'Asha Rep', won: 4, conversion_rate: 40 });
    });

    it('returns the full KPI/chart shape in a single call', async () => {
      const { service } = buildService();
      const res = (await service.getDashboard(TENANT, makeUser(['org_admin']), {} as any)) as any;
      expect(res).toHaveProperty('properties');
      expect(res).toHaveProperty('leads');
      expect(res).toHaveProperty('revenue');
      expect(res).toHaveProperty('funnel');
      expect(res).toHaveProperty('sources');
      expect(res).toHaveProperty('monthly_leads');
      expect(res).toHaveProperty('monthly_conversion');
      expect(res).toHaveProperty('employees');
      expect(res).toHaveProperty('generated_at');
    });
  });

  // ===========================================================================
  // Platform analytics
  // ===========================================================================
  describe('getPlatformDashboard', () => {
    it('computes org status split, totals and MRR/ARR from tiers', async () => {
      const { service, repo } = buildService();
      repo.organizationStatusCounts!.mockResolvedValue([
        { status: 'active', _count: { _all: 6 } },
        { status: 'trial', _count: { _all: 3 } },
        { status: 'suspended', _count: { _all: 1 } },
      ] as any);
      repo.organizationTierCounts!.mockResolvedValue([
        { tier: 'pro', _count: { _all: 4 } },
        { tier: 'basic', _count: { _all: 2 } },
      ] as any);
      repo.activePlans!.mockResolvedValue([
        { code: 'starter', price_inr_monthly: 2999 },
        { code: 'growth', price_inr_monthly: 6999 },
        { code: 'enterprise', price_inr_monthly: 14999 },
      ]);
      repo.countAllUsers!.mockResolvedValue(42);
      repo.countAllProperties!.mockResolvedValue(120);
      repo.countAllInquiries!.mockResolvedValue(310);

      const res = (await service.getPlatformDashboard({} as any)) as any;
      expect(res.organizations.total).toBe(10);
      expect(res.organizations.active).toBe(6);
      expect(res.organizations.trial).toBe(3);
      // MRR = pro(4 → growth 6999) + basic(2 → starter 2999) = 27996 + 5998 = 33994
      expect(res.revenue.mrr).toBe(33994);
      expect(res.revenue.arr).toBe(33994 * 12);
      expect(res.totals).toEqual({ users: 42, properties: 120, leads: 310 });
      expect(res.platform_health.status).toBe('healthy');
    });
  });
});

