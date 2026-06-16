import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUser } from '../../common/context/auth-user';
import {
  ANALYTICS_DEFAULT_RANGE,
  ANALYTICS_FULL_ACCESS_ROLES,
  ANALYTICS_PERFORMANCE_VIEW_ROLES,
  ANALYTICS_TEAM_ACCESS_ROLES,
  CURRENCY,
  FUNNEL_STEPS,
  NO_MATCH_UUID,
  PROPERTY_STATUS_KEYS,
  QUALIFIED_PLUS_STAGES,
  STAGE_RANK,
  type AnalyticsScopeType,
  type AnalyticsTimeRange,
} from './analytics.constants';
import { AnalyticsCacheService } from './analytics-cache.service';
import {
  AnalyticsRepository,
  type AnalyticsScope,
  type DateRange,
  type EmployeePerfRow,
} from './analytics.repository';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

/** Map a tenant tier to its subscription plan code (mirrors employees module). */
const TIER_TO_PLAN: Record<string, string> = {
  basic: 'starter',
  starter: 'starter',
  pro: 'pro',
  growth: 'pro',
  enterprise: 'enterprise',
};

type ResolvedRange = DateRange & { range: AnalyticsTimeRange };

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly cache: AnalyticsCacheService,
  ) {}

  // ===========================================================================
  // RBAC scope + time range resolution
  // ===========================================================================

  private scopeType(user: AuthUser): AnalyticsScopeType {
    if (user.roles.some((r) => ANALYTICS_FULL_ACCESS_ROLES.includes(r))) return 'all';
    if (user.roles.some((r) => ANALYTICS_TEAM_ACCESS_ROLES.includes(r))) return 'team';
    return 'assigned';
  }

  private canViewPerformance(user: AuthUser): boolean {
    return user.roles.some((r) => ANALYTICS_PERFORMANCE_VIEW_ROLES.includes(r));
  }

  async resolveScope(user: AuthUser, tenantId: string): Promise<AnalyticsScope> {
    const type = this.scopeType(user);
    if (type === 'all') return { type: 'all' };

    const employee = await this.repo.findEmployeeByUserId(tenantId, user.userId);
    if (!employee) return { type: 'employees', employeeIds: [] };

    if (type === 'team') {
      const subordinates = await this.repo.findSubordinateEmployeeIds(employee.id);
      return { type: 'employees', employeeIds: [employee.id, ...subordinates] };
    }
    return { type: 'employees', employeeIds: [employee.id] };
  }

  resolveRange(dto: AnalyticsQueryDto): ResolvedRange {
    const range = dto.range ?? ANALYTICS_DEFAULT_RANGE;
    const now = new Date();

    if (range === 'custom') {
      return {
        range,
        from: dto.date_from ? new Date(dto.date_from) : undefined,
        to: dto.date_to ? new Date(dto.date_to) : undefined,
      };
    }

    if (range === 'today') {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { range, from, to: now };
    }

    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { range, from, to: now };
  }

  private cacheKey(prefix: string, scope: AnalyticsScope, range: ResolvedRange, extra = ''): string {
    const scopeKey =
      scope.type === 'all' ? 'all' : `emp:${[...scope.employeeIds].sort().join(',')}`;
    const rangeKey = `${range.range}:${range.from?.toISOString() ?? ''}:${range.to?.toISOString() ?? ''}`;
    return `${prefix}|${scopeKey}|${rangeKey}|${extra}`;
  }

  private toNum(value: Prisma.Decimal | number | null | undefined): number {
    return value == null ? 0 : Number(value);
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }

  // ===========================================================================
  // Building blocks (each is independently cacheable + reusable)
  // ===========================================================================

  private async leadKpis(tenantId: string, scope: AnalyticsScope, range: DateRange) {
    const where = this.repo.buildInquiryWhere(tenantId, scope, range);
    const [stageRows, total, siteVisits] = await Promise.all([
      this.repo.stageCounts(where),
      this.repo.countInquiries(where),
      this.repo.countSiteVisits(this.repo.buildSiteVisitWhere(tenantId, scope, range)),
    ]);

    const byStage: Record<string, number> = {};
    for (const row of stageRows) byStage[row.stage] = row._count._all;

    const qualified = QUALIFIED_PLUS_STAGES.reduce((sum, s) => sum + (byStage[s] ?? 0), 0);
    const won = byStage.CLOSED_WON ?? 0;
    const lost = byStage.CLOSED_LOST ?? 0;

    return {
      total,
      new: byStage.NEW ?? 0,
      contacted: byStage.CONTACTED ?? 0,
      qualified,
      site_visits: siteVisits,
      won,
      lost,
      conversion_rate: total ? this.round((won / total) * 100) : 0,
      by_stage: byStage,
    };
  }

  private async propertyKpis(tenantId: string, scope: AnalyticsScope) {
    const where = this.repo.buildPropertyWhere(tenantId, scope);
    const [statusRows, active] = await Promise.all([
      this.repo.propertyStatusCounts(where),
      this.repo.countActiveProperties(where),
    ]);

    const byStatus: Record<string, number> = {};
    for (const key of PROPERTY_STATUS_KEYS) byStatus[key] = 0;
    let total = 0;
    for (const row of statusRows) {
      byStatus[row.status] = row._count._all;
      total += row._count._all;
    }

    return {
      total,
      active,
      published: byStatus.published ?? 0,
      reserved: byStatus.reserved ?? 0,
      sold: byStatus.sold ?? 0,
      draft: byStatus.draft ?? 0,
      by_status: byStatus,
    };
  }

  private async funnelData(tenantId: string, scope: AnalyticsScope, range: DateRange) {
    const where = this.repo.buildInquiryWhere(tenantId, scope, range);
    const stageRows = await this.repo.stageCounts(where);
    const byStage: Record<string, number> = {};
    for (const row of stageRows) byStage[row.stage] = row._count._all;

    // "this stage or beyond" along the happy path (won counted separately).
    return FUNNEL_STEPS.map((step) => {
      const rank = STAGE_RANK[step.stage];
      let count = 0;
      for (const [stage, n] of Object.entries(byStage)) {
        if (stage === 'CLOSED_LOST') continue;
        const r = STAGE_RANK[stage];
        if (r !== undefined && r >= rank) count += n;
      }
      return { key: step.key, label: step.label, count };
    });
  }

  private async sourceData(tenantId: string, scope: AnalyticsScope, range: DateRange) {
    const where = this.repo.buildInquiryWhere(tenantId, scope, range);
    const rows = await this.repo.sourceCounts(where);
    return rows
      .map((row) => ({ source: row.source_name ?? 'Unknown', count: row._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  private async revenueData(tenantId: string, scope: AnalyticsScope, range: DateRange) {
    // Revenue is recognised on the close date (BR-aligned with KPI_FRAMEWORK).
    const where = this.repo.buildInquiryWhere(tenantId, scope, range, { dateField: 'closed_at' });
    const deals = await this.repo.wonDeals(where);
    let won_amount = 0;
    for (const deal of deals) {
      const value =
        this.toNum(deal.received_commission) ||
        this.toNum(deal.expected_commission) ||
        this.toNum(deal.booking_amount) ||
        this.toNum(deal.property?.price) ||
        this.toNum(deal.budget_max) ||
        this.toNum(deal.budget_min);
      won_amount += value;
    }
    return {
      currency: CURRENCY,
      won_deals: deals.length,
      won_amount,
      avg_deal_value: deals.length ? this.round(won_amount / deals.length) : 0,
    };
  }

  private async employeeTable(
    tenantId: string,
    scope: AnalyticsScope,
    range: DateRange,
  ) {
    const rows = await this.repo.employeePerformance(tenantId, scope, range);
    if (!rows.length) return [];
    const names = await this.repo.employeeNames(rows.map((r) => r.employee_id));
    return rows
      .map((r: EmployeePerfRow) => ({
        employee_id: r.employee_id,
        name: names.get(r.employee_id) ?? 'Unknown',
        leads: r.total,
        won: r.won,
        lost: r.lost,
        site_visits: r.site_visits,
        conversion_rate: r.total ? this.round((r.won / r.total) * 100) : 0,
      }))
      .sort((a, b) => b.won - a.won || b.leads - a.leads);
  }

  private async slaData(tenantId: string, scope: AnalyticsScope) {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { start: today, end: tomorrow } = this.kolkataDayWindow(now);

    const scopedInquiryWhere = this.repo.buildInquiryWhere(tenantId, scope, {});
    const followupScope: Prisma.inquiry_followupsWhereInput =
      scope.type === 'employees'
        ? { assigned_employee_id: scope.employeeIds.length ? { in: scope.employeeIds } : NO_MATCH_UUID }
        : {};

    const [staleNewLeads, unassignedLeads, dueTodayFollowups, overdueFollowups, missedFollowups] = await Promise.all([
      this.repo.countInquiries({
        ...scopedInquiryWhere,
        stage: 'NEW',
        created_at: { lte: staleCutoff },
      }),
      scope.type === 'all'
        ? this.repo.countInquiries({
            tenant_id: tenantId,
            deleted_at: null,
            assigned_employee_id: null,
            stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
          })
        : Promise.resolve(0),
      this.repo.countFollowups({
        tenant_id: tenantId,
        ...followupScope,
        status: 'pending',
        followup_date: { gte: today, lt: tomorrow },
      }),
      this.repo.countFollowups({
        tenant_id: tenantId,
        ...followupScope,
        status: 'pending',
        followup_date: { lt: today },
      }),
      this.repo.countFollowups({
        tenant_id: tenantId,
        ...followupScope,
        status: 'missed',
      }),
    ]);

    return {
      stale_new_leads: staleNewLeads,
      unassigned_leads: unassignedLeads,
      due_today_followups: dueTodayFollowups,
      overdue_followups: overdueFollowups,
      missed_followups: missedFollowups,
    };
  }

  private kolkataDayWindow(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value);
    const start = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private trendSince(months: number): Date {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    return since;
  }

  // ===========================================================================
  // Public endpoint methods (tenant: org / team / employee)
  // ===========================================================================

  /** Single aggregation endpoint powering the dashboard home (1 round trip). */
  async getDashboard(tenantId: string, user: AuthUser, dto: AnalyticsQueryDto) {
    const scope = await this.resolveScope(user, tenantId);
    const range = this.resolveRange(dto);
    const showPerformance = this.canViewPerformance(user);

    return this.cache.wrap(this.cacheKey(`${tenantId}:dashboard`, scope, range, String(showPerformance)), async () => {
      const since = this.trendSince(6);
      const [
        properties,
        leads,
        revenue,
        funnel,
        sources,
        monthlyLeads,
        monthlyConv,
        employees,
        teamSize,
        sla,
      ] = await Promise.all([
        this.propertyKpis(tenantId, scope),
        this.leadKpis(tenantId, scope, range),
        this.revenueData(tenantId, scope, range),
        this.funnelData(tenantId, scope, range),
        this.sourceData(tenantId, scope, range),
        this.repo.monthlyLeads(tenantId, scope, since),
        this.repo.monthlyConversion(tenantId, scope, since),
        showPerformance ? this.employeeTable(tenantId, scope, range) : Promise.resolve([]),
        this.repo.countEmployees(tenantId, scope),
        this.slaData(tenantId, scope),
      ]);

      return {
        scope: scope.type === 'all' ? 'all' : this.scopeType(user),
        range: this.serializeRange(range),
        properties,
        leads,
        revenue,
        funnel,
        sources,
        monthly_leads: monthlyLeads,
        monthly_conversion: monthlyConv.map((m) => ({
          month: m.month,
          leads: m.leads,
          won: m.won,
          conversion_rate: m.leads ? this.round((m.won / m.leads) * 100) : 0,
        })),
        employees,
        team_size: teamSize,
        sla,
        generated_at: new Date().toISOString(),
      };
    });
  }

  async getLeads(tenantId: string, user: AuthUser, dto: AnalyticsQueryDto) {
    const scope = await this.resolveScope(user, tenantId);
    const range = this.resolveRange(dto);
    return this.cache.wrap(this.cacheKey(`${tenantId}:leads`, scope, range), async () => {
      const since = this.trendSince(6);
      const [leads, monthly] = await Promise.all([
        this.leadKpis(tenantId, scope, range),
        this.repo.monthlyLeads(tenantId, scope, since),
      ]);
      return { range: this.serializeRange(range), ...leads, monthly_leads: monthly };
    });
  }

  async getProperties(tenantId: string, user: AuthUser) {
    const scope = await this.resolveScope(user, tenantId);
    return this.cache.wrap(`${tenantId}:properties|${scope.type === 'all' ? 'all' : scope.employeeIds.join(',')}`, () =>
      this.propertyKpis(tenantId, scope),
    );
  }

  async getEmployees(tenantId: string, user: AuthUser, dto: AnalyticsQueryDto) {
    const scope = await this.resolveScope(user, tenantId);
    const range = this.resolveRange(dto);
    return this.cache.wrap(this.cacheKey(`${tenantId}:employees`, scope, range), async () => ({
      range: this.serializeRange(range),
      employees: await this.employeeTable(tenantId, scope, range),
    }));
  }

  async getFunnel(tenantId: string, user: AuthUser, dto: AnalyticsQueryDto) {
    const scope = await this.resolveScope(user, tenantId);
    const range = this.resolveRange(dto);
    return this.cache.wrap(this.cacheKey(`${tenantId}:funnel`, scope, range), async () => ({
      range: this.serializeRange(range),
      funnel: await this.funnelData(tenantId, scope, range),
    }));
  }

  async getSources(tenantId: string, user: AuthUser, dto: AnalyticsQueryDto) {
    const scope = await this.resolveScope(user, tenantId);
    const range = this.resolveRange(dto);
    return this.cache.wrap(this.cacheKey(`${tenantId}:sources`, scope, range), async () => ({
      range: this.serializeRange(range),
      sources: await this.sourceData(tenantId, scope, range),
    }));
  }

  async getConversions(tenantId: string, user: AuthUser, dto: AnalyticsQueryDto) {
    const scope = await this.resolveScope(user, tenantId);
    const range = this.resolveRange(dto);
    return this.cache.wrap(this.cacheKey(`${tenantId}:conversions`, scope, range), async () => {
      const since = this.trendSince(6);
      const [leads, monthly] = await Promise.all([
        this.leadKpis(tenantId, scope, range),
        this.repo.monthlyConversion(tenantId, scope, since),
      ]);
      return {
        range: this.serializeRange(range),
        conversion_rate: leads.conversion_rate,
        total_leads: leads.total,
        won: leads.won,
        lost: leads.lost,
        monthly_conversion: monthly.map((m) => ({
          month: m.month,
          leads: m.leads,
          won: m.won,
          conversion_rate: m.leads ? this.round((m.won / m.leads) * 100) : 0,
        })),
      };
    });
  }

  async getRevenue(tenantId: string, user: AuthUser, dto: AnalyticsQueryDto) {
    const scope = await this.resolveScope(user, tenantId);
    const range = this.resolveRange(dto);
    return this.cache.wrap(this.cacheKey(`${tenantId}:revenue`, scope, range), async () => ({
      range: this.serializeRange(range),
      ...(await this.revenueData(tenantId, scope, range)),
    }));
  }

  // ===========================================================================
  // Platform analytics (Super Admin — cross-tenant, no tenant scope)
  // ===========================================================================

  async getPlatformDashboard(dto: AnalyticsQueryDto) {
    const range = this.resolveRange(dto);
    return this.cache.wrap(`platform:dashboard|${range.range}`, async () => {
      const since = this.trendSince(6);
      const [statusRows, tierRows, users, properties, inquiries, plans, growth] = await Promise.all([
        this.repo.organizationStatusCounts(),
        this.repo.organizationTierCounts(),
        this.repo.countAllUsers(),
        this.repo.countAllProperties(),
        this.repo.countAllInquiries(),
        this.repo.activePlans(),
        this.repo.monthlyOrgGrowth(since),
      ]);

      const byStatus: Record<string, number> = {};
      let totalOrgs = 0;
      for (const row of statusRows) {
        byStatus[row.status] = row._count._all;
        totalOrgs += row._count._all;
      }

      // MRR estimate: paying orgs (active) mapped tier → plan monthly price.
      const planPrice = new Map(plans.map((p) => [p.code, p.price_inr_monthly]));
      let mrr = 0;
      for (const row of tierRows) {
        const planCode = TIER_TO_PLAN[row.tier] ?? 'starter';
        mrr += (planPrice.get(planCode) ?? 0) * row._count._all;
      }

      const tierBreakdown = tierRows
        .map((row) => ({ tier: row.tier, count: row._count._all }))
        .sort((a, b) => b.count - a.count);

      return {
        range: this.serializeRange(range),
        organizations: {
          total: totalOrgs,
          active: byStatus.active ?? 0,
          trial: byStatus.trial ?? 0,
          suspended: byStatus.suspended ?? 0,
          past_due: byStatus.past_due ?? 0,
        },
        revenue: { currency: CURRENCY, mrr, arr: mrr * 12 },
        totals: {
          users,
          properties,
          leads: inquiries,
        },
        tier_breakdown: tierBreakdown,
        monthly_growth: growth.map((g) => ({ month: g.month, organizations: g.leads })),
        platform_health: this.platformHealth(byStatus, totalOrgs),
        generated_at: new Date().toISOString(),
      };
    });
  }

  private platformHealth(byStatus: Record<string, number>, total: number) {
    const active = byStatus.active ?? 0;
    const suspended = byStatus.suspended ?? 0;
    const activeRatio = total ? active / total : 0;
    const status = suspended > active ? 'at_risk' : activeRatio >= 0.5 ? 'healthy' : 'growing';
    return {
      status,
      active_ratio: this.round(activeRatio * 100),
    };
  }

  private serializeRange(range: ResolvedRange) {
    return {
      range: range.range,
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
    };
  }
}
