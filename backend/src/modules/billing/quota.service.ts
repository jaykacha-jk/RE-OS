import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { organization_usage, subscription_plans } from '@prisma/client';

import { tierToPlanCode } from '../platform/org-tier';
import { BillingRepository } from './billing.repository';
import { isUnlimitedCount, isUnlimitedStorage } from './quota.constants';

const READ_ONLY_ORG_STATUSES = new Set(['suspended', 'cancelled']);

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trial', 'past_due']);

type PlanRow = subscription_plans;

type UsageRow = organization_usage | null;

export type TenantQuotaContext = {
  tenantId: string;
  orgStatus: string;
  planCode: string;
  plan: PlanRow;
  usage: UsageRow;
};

@Injectable()
export class QuotaService {
  private readonly contextCache = new Map<string, { ctx: TenantQuotaContext; expiresAt: number }>();
  private readonly contextTtlMs = 5 * 60 * 1000;

  constructor(private readonly repo: BillingRepository) {}

  async getContext(tenantId: string): Promise<TenantQuotaContext> {
    const now = Date.now();
    const cached = this.contextCache.get(tenantId);
    if (cached && cached.expiresAt > now) return cached.ctx;

    const ctx = await this.loadContext(tenantId);
    this.contextCache.set(tenantId, { ctx, expiresAt: now + this.contextTtlMs });
    return ctx;
  }

  private async loadContext(tenantId: string): Promise<TenantQuotaContext> {
    const org = await this.repo.findOrganization(tenantId);
    if (!org) throw new NotFoundException('Organization not found');

    const subscription = await this.repo.findCurrentSubscription(tenantId);
    let plan: PlanRow | null = null;

    if (subscription?.plan && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      plan = subscription.plan;
    }

    if (!plan) {
      const planCode = tierToPlanCode(org.tier);
      plan = await this.repo.findPlanByCode(planCode);
    }

    if (!plan) throw new NotFoundException('Plan not found');

    return {
      tenantId,
      orgStatus: org.status,
      planCode: plan.code,
      plan,
      usage: org.organization_usage ?? null,
    };
  }

  /** BR-T02 — block creates for suspended / cancelled tenants. */
  assertOrgCanCreate(ctx: TenantQuotaContext): void {
    if (READ_ONLY_ORG_STATUSES.has(ctx.orgStatus)) {
      throw new UnprocessableEntityException({
        code: 'ORG_READ_ONLY',
        message: 'Organization is in read-only mode. Upgrade or contact support to restore access.',
        rule_id: 'BR-T02',
        upgrade_url: '/billing/plans',
      });
    }
  }

  private quotaExceeded(message: string, meta?: Record<string, unknown>): never {
    throw new UnprocessableEntityException({
      code: 'QUOTA_EXCEEDED',
      message,
      rule_id: 'BR-T04',
      upgrade_url: '/billing/plans',
      ...meta,
    });
  }

  async assertCanCreateProperty(tenantId: string): Promise<TenantQuotaContext> {
    const ctx = await this.getContext(tenantId);
    this.assertOrgCanCreate(ctx);

    const max = ctx.plan.max_properties;
    const current = ctx.usage?.properties_count ?? 0;
    if (!isUnlimitedCount(max) && current >= max) {
      this.quotaExceeded('Property quota exceeded for current plan', {
        resource: 'properties',
        limit: max,
        used: current,
      });
    }

    return ctx;
  }

  async assertCanCreateEmployee(tenantId: string): Promise<TenantQuotaContext> {
    const ctx = await this.getContext(tenantId);
    this.assertOrgCanCreate(ctx);

    const max = ctx.plan.max_employees;
    const current = ctx.usage?.employees_count ?? 0;
    if (!isUnlimitedCount(max) && current >= max) {
      this.quotaExceeded('Employee quota exceeded for current plan', {
        resource: 'employees',
        limit: max,
        used: current,
      });
    }

    return ctx;
  }

  /**
   * BR-T04 — AI minutes quota. `minutes` defaults to 1 for chat turns / call initiation.
   * When plan max is 0, AI usage is not included on the tier.
   */
  async assertAiMinutesAvailable(tenantId: string, minutes = 1): Promise<TenantQuotaContext> {
    const ctx = await this.getContext(tenantId);
    this.assertOrgCanCreate(ctx);

    const max = ctx.plan.max_ai_minutes_monthly;
    if (max <= 0) {
      this.quotaExceeded('AI minutes are not included on your current plan', {
        resource: 'ai_minutes',
        limit: 0,
        used: ctx.usage?.ai_minutes_used ?? 0,
      });
    }

    const current = ctx.usage?.ai_minutes_used ?? 0;
    if (!isUnlimitedCount(max) && current + minutes > max) {
      this.quotaExceeded('AI minutes quota exceeded for current plan', {
        resource: 'ai_minutes',
        limit: max,
        used: current,
      });
    }

    return ctx;
  }

  async assertStorageAvailable(tenantId: string, additionalBytes: number): Promise<TenantQuotaContext> {
    const ctx = await this.getContext(tenantId);
    this.assertOrgCanCreate(ctx);

    if (additionalBytes <= 0) return ctx;

    const limit = ctx.plan.storage_limit_bytes;
    if (isUnlimitedStorage(limit)) return ctx;

    const current = Number(ctx.usage?.storage_bytes ?? 0n);
    const max = Number(limit);
    if (current + additionalBytes > max) {
      this.quotaExceeded('Storage quota exceeded for current plan', {
        resource: 'storage_bytes',
        limit: max,
        used: current,
      });
    }

    return ctx;
  }

  async recordStorageBytes(tenantId: string, deltaBytes: number): Promise<void> {
    if (!deltaBytes) return;
    await this.repo.adjustStorageBytes(tenantId, deltaBytes);
  }

  async recordAiMinutes(tenantId: string, minutes: number): Promise<void> {
    if (minutes <= 0) return;
    await this.repo.incrementAiMinutes(tenantId, minutes);
  }
}
