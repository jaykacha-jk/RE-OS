import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { NO_MATCH_UUID, PROPERTY_ACTIVE_STATUSES } from './analytics.constants';

export type AnalyticsScope = { type: 'all' } | { type: 'employees'; employeeIds: string[] };

export type DateRange = { from?: Date; to?: Date };

export type EmployeePerfRow = {
  employee_id: string;
  total: number;
  won: number;
  lost: number;
  site_visits: number;
};

export type MonthlyLeadRow = { month: string; leads: number };
export type MonthlyConversionRow = { month: string; leads: number; won: number };

@Injectable()
export class AnalyticsRepository extends TenantScopedRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ===========================================================================
  // Scope helpers (employee resolution mirrors CRM)
  // ===========================================================================

  async findEmployeeByUserId(tenantId: string, userId: string) {
    return this.prisma.dbClient.employees.findFirst({
      where: { user_id: userId, deleted_at: null, user: { tenant_id: tenantId, deleted_at: null } },
      select: { id: true },
    });
  }

  async findSubordinateEmployeeIds(managerEmployeeId: string) {
    const rows = await this.prisma.dbClient.employees.findMany({
      where: { manager_id: managerEmployeeId, deleted_at: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async employeeNames(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!ids.length) return map;
    const rows = await this.prisma.dbClient.employees.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        user: { select: { first_name: true, last_name: true, email: true } },
      },
    });
    for (const row of rows) {
      const name =
        [row.user?.first_name, row.user?.last_name].filter(Boolean).join(' ') ||
        row.user?.email ||
        'Unknown';
      map.set(row.id, name);
    }
    return map;
  }

  /** Count active (non-deleted) employees in scope. */
  async countEmployees(tenantId: string, scope: AnalyticsScope) {
    return this.prisma.dbClient.employees.count({
      where: {
        deleted_at: null,
        status: 'active',
        user: { tenant_id: tenantId, deleted_at: null },
        ...(scope.type === 'employees'
          ? { id: scope.employeeIds.length ? { in: scope.employeeIds } : NO_MATCH_UUID }
          : {}),
      },
    });
  }

  // ===========================================================================
  // WHERE builders
  // ===========================================================================

  buildInquiryWhere(
    tenantId: string,
    scope: AnalyticsScope,
    range: DateRange,
    opts: { dateField?: 'created_at' | 'closed_at' } = {},
  ): Prisma.inquiriesWhereInput {
    const dateField = opts.dateField ?? 'created_at';
    const where: Prisma.inquiriesWhereInput = this.tenantWhere(tenantId, { deleted_at: null });

    if (range.from || range.to) {
      where[dateField] = {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      };
    }

    if (scope.type === 'employees') {
      where.assigned_employee_id = scope.employeeIds.length
        ? { in: scope.employeeIds }
        : NO_MATCH_UUID;
    }

    return where;
  }

  buildSiteVisitWhere(
    tenantId: string,
    scope: AnalyticsScope,
    range: DateRange,
  ): Prisma.site_visitsWhereInput {
    const where: Prisma.site_visitsWhereInput = this.tenantWhere(tenantId);
    if (range.from || range.to) {
      where.scheduled_at = {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      };
    }
    if (scope.type === 'employees') {
      where.employee_id = scope.employeeIds.length ? { in: scope.employeeIds } : NO_MATCH_UUID;
    }
    return where;
  }

  buildPropertyWhere(tenantId: string, scope: AnalyticsScope): Prisma.propertiesWhereInput {
    const where: Prisma.propertiesWhereInput = this.tenantWhere(tenantId, { deleted_at: null });
    if (scope.type === 'employees') {
      where.assignments = {
        some: {
          employee_id: scope.employeeIds.length ? { in: scope.employeeIds } : NO_MATCH_UUID,
        },
      };
    }
    return where;
  }

  // ===========================================================================
  // Inquiry aggregates
  // ===========================================================================

  async stageCounts(where: Prisma.inquiriesWhereInput) {
    this.assertTenantWhere('AnalyticsRepository.stageCounts', where as Record<string, unknown>);
    return this.prisma.dbClient.inquiries.groupBy({
      by: ['stage'],
      where,
      _count: { _all: true },
    });
  }

  async countInquiries(where: Prisma.inquiriesWhereInput) {
    this.assertTenantWhere('AnalyticsRepository.countInquiries', where as Record<string, unknown>);
    return this.prisma.dbClient.inquiries.count({ where });
  }

  async countSiteVisits(where: Prisma.site_visitsWhereInput) {
    this.assertTenantWhere('AnalyticsRepository.countSiteVisits', where as Record<string, unknown>);
    return this.prisma.dbClient.site_visits.count({ where });
  }

  async sourceCounts(where: Prisma.inquiriesWhereInput) {
    this.assertTenantWhere('AnalyticsRepository.sourceCounts', where as Record<string, unknown>);
    return this.prisma.dbClient.inquiries.groupBy({
      by: ['source_name'],
      where,
      _count: { _all: true },
    });
  }

  /** Won deals (by closed_at) with the data needed to estimate revenue. */
  async wonDeals(where: Prisma.inquiriesWhereInput) {
    this.assertTenantWhere('AnalyticsRepository.wonDeals', where as Record<string, unknown>);
    return this.prisma.dbClient.inquiries.findMany({
      where: { ...where, stage: 'CLOSED_WON' },
      select: {
        id: true,
        budget_max: true,
        budget_min: true,
        property: { select: { price: true } },
      },
    });
  }

  // ===========================================================================
  // Property aggregates (current snapshot)
  // ===========================================================================

  async propertyStatusCounts(where: Prisma.propertiesWhereInput) {
    this.assertTenantWhere('AnalyticsRepository.propertyStatusCounts', where as Record<string, unknown>);
    return this.prisma.dbClient.properties.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
  }

  async countActiveProperties(where: Prisma.propertiesWhereInput) {
    this.assertTenantWhere('AnalyticsRepository.countActiveProperties', where as Record<string, unknown>);
    return this.prisma.dbClient.properties.count({
      where: { ...where, status: { in: PROPERTY_ACTIVE_STATUSES } },
    });
  }

  // ===========================================================================
  // Employee performance (batched — no N+1)
  // ===========================================================================

  async employeePerformance(
    tenantId: string,
    scope: AnalyticsScope,
    range: DateRange,
  ): Promise<EmployeePerfRow[]> {
    const base = this.buildInquiryWhere(tenantId, scope, range);
    const assignedBase: Prisma.inquiriesWhereInput = {
      ...base,
      assigned_employee_id:
        scope.type === 'employees'
          ? base.assigned_employee_id
          : { not: null },
    };

    const [totals, won, lost, visits] = await Promise.all([
      this.prisma.dbClient.inquiries.groupBy({
        by: ['assigned_employee_id'],
        where: assignedBase,
        _count: { _all: true },
      }),
      this.prisma.dbClient.inquiries.groupBy({
        by: ['assigned_employee_id'],
        where: { ...assignedBase, stage: 'CLOSED_WON' },
        _count: { _all: true },
      }),
      this.prisma.dbClient.inquiries.groupBy({
        by: ['assigned_employee_id'],
        where: { ...assignedBase, stage: 'CLOSED_LOST' },
        _count: { _all: true },
      }),
      this.prisma.dbClient.site_visits.groupBy({
        by: ['employee_id'],
        where: this.buildSiteVisitWhere(tenantId, scope, range),
        _count: { _all: true },
      }),
    ]);

    const rows = new Map<string, EmployeePerfRow>();
    const ensure = (id: string | null): EmployeePerfRow | null => {
      if (!id) return null;
      let row = rows.get(id);
      if (!row) {
        row = { employee_id: id, total: 0, won: 0, lost: 0, site_visits: 0 };
        rows.set(id, row);
      }
      return row;
    };

    for (const t of totals) ensure(t.assigned_employee_id)!.total = t._count._all;
    for (const w of won) {
      const r = ensure(w.assigned_employee_id);
      if (r) r.won = w._count._all;
    }
    for (const l of lost) {
      const r = ensure(l.assigned_employee_id);
      if (r) r.lost = l._count._all;
    }
    for (const v of visits) {
      const r = ensure(v.employee_id);
      if (r) r.site_visits = v._count._all;
    }

    return [...rows.values()];
  }

  // ===========================================================================
  // Monthly trends (parameterized raw SQL — date_trunc bucketing)
  // ===========================================================================

  private scopeFilterSql(scope: AnalyticsScope): Prisma.Sql {
    if (scope.type === 'all') return Prisma.empty;
    if (!scope.employeeIds.length) {
      return Prisma.sql`AND assigned_employee_id = ${NO_MATCH_UUID}::uuid`;
    }
    return Prisma.sql`AND assigned_employee_id IN (${Prisma.join(
      scope.employeeIds.map((id) => Prisma.sql`${id}::uuid`),
    )})`;
  }

  async monthlyLeads(
    tenantId: string,
    scope: AnalyticsScope,
    since: Date,
  ): Promise<MonthlyLeadRow[]> {
    const rows = await this.prisma.dbClient.$queryRaw<{ month: Date; leads: bigint }[]>(Prisma.sql`
      SELECT date_trunc('month', created_at) AS month, COUNT(*)::bigint AS leads
      FROM inquiries
      WHERE tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
        AND created_at >= ${since}
        ${this.scopeFilterSql(scope)}
      GROUP BY 1
      ORDER BY 1 ASC
    `);
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      leads: Number(r.leads),
    }));
  }

  async monthlyConversion(
    tenantId: string,
    scope: AnalyticsScope,
    since: Date,
  ): Promise<MonthlyConversionRow[]> {
    const rows = await this.prisma.dbClient.$queryRaw<
      { month: Date; leads: bigint; won: bigint }[]
    >(Prisma.sql`
      SELECT date_trunc('month', created_at) AS month,
             COUNT(*)::bigint AS leads,
             COUNT(*) FILTER (WHERE stage = 'CLOSED_WON')::bigint AS won
      FROM inquiries
      WHERE tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
        AND created_at >= ${since}
        ${this.scopeFilterSql(scope)}
      GROUP BY 1
      ORDER BY 1 ASC
    `);
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      leads: Number(r.leads),
      won: Number(r.won),
    }));
  }

  // ===========================================================================
  // Platform aggregates (Super Admin — cross-tenant)
  // ===========================================================================

  async organizationStatusCounts() {
    return this.prisma.dbClient.organizations.groupBy({
      by: ['status'],
      where: { deleted_at: null },
      _count: { _all: true },
    });
  }

  async organizationTierCounts() {
    return this.prisma.dbClient.organizations.groupBy({
      by: ['tier'],
      where: { deleted_at: null, status: { in: ['active', 'trial', 'past_due'] } },
      _count: { _all: true },
    });
  }

  async countAllUsers() {
    return this.prisma.dbClient.users.count({ where: { deleted_at: null } });
  }

  async countAllProperties() {
    return this.prisma.dbClient.properties.count({ where: { deleted_at: null } });
  }

  async countAllInquiries() {
    return this.prisma.dbClient.inquiries.count({ where: { deleted_at: null } });
  }

  async activePlans() {
    return this.prisma.dbClient.subscription_plans.findMany({
      where: { is_active: true },
      select: { code: true, price_inr_monthly: true },
    });
  }

  async monthlyOrgGrowth(since: Date): Promise<MonthlyLeadRow[]> {
    const rows = await this.prisma.dbClient.$queryRaw<{ month: Date; leads: bigint }[]>(Prisma.sql`
      SELECT date_trunc('month', created_at) AS month, COUNT(*)::bigint AS leads
      FROM organizations
      WHERE deleted_at IS NULL
        AND created_at >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `);
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      leads: Number(r.leads),
    }));
  }
}
