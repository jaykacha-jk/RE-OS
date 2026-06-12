import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUser } from '../../common/context/auth-user';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import {
  BILLING_EVENT_KEYS,
  GST_RATE,
  TRIAL_DAYS,
  type BillingCycle,
  type BillingPlanCode,
} from './billing.constants';
import { BillingRepository } from './billing.repository';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { RazorpayWebhookDto } from './dto/razorpay-webhook.dto';
import { SubscribeDto } from './dto/subscribe.dto';
import { MockProvider } from './providers/mock.provider';
import type { PaymentProvider } from './providers/payment-provider';
import { RazorpayProvider } from './providers/razorpay.provider';

type SubscriptionRow = NonNullable<Awaited<ReturnType<BillingRepository['findCurrentSubscription']>>>;

@Injectable()
export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly mockProvider: MockProvider,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly audit: AuditService,
    private readonly events: DomainEventBus,
  ) {}

  private provider(): PaymentProvider {
    return process.env.PAYMENT_PROVIDER === 'razorpay' ? this.razorpayProvider : this.mockProvider;
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private addBillingPeriod(date: Date, cycle: BillingCycle): Date {
    const next = new Date(date);
    if (cycle === 'yearly') next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);
    return next;
  }

  private amountForPlan(
    plan: { price_inr_monthly: number; price_inr_yearly: number | null },
    cycle: BillingCycle,
  ) {
    return cycle === 'yearly' ? (plan.price_inr_yearly ?? plan.price_inr_monthly * 10) : plan.price_inr_monthly;
  }

  private invoiceNumber(tenantId: string) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `INV-${stamp}-${tenantId.slice(0, 6).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
  }

  private money(value: number) {
    return Math.round(value);
  }

  private formatPlan(plan: {
    id: string;
    code: string;
    name: string;
    price_inr_monthly: number;
    price_inr_yearly: number | null;
    max_properties: number;
    max_employees: number;
    storage_limit_bytes: bigint;
    features: Prisma.JsonValue;
    is_active: boolean;
  }) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      monthly_price: plan.price_inr_monthly,
      yearly_price: plan.price_inr_yearly,
      property_limit: plan.max_properties,
      employee_limit: plan.max_employees,
      storage_limit: Number(plan.storage_limit_bytes),
      features: plan.features,
      is_active: plan.is_active,
    };
  }

  private formatSubscription(subscription: SubscriptionRow | null) {
    if (!subscription) return null;
    return {
      id: subscription.id,
      tenant_id: subscription.tenant_id,
      plan: this.formatPlan(subscription.plan),
      status: subscription.status,
      billing_cycle: subscription.billing_cycle,
      provider: subscription.provider,
      provider_subscription_id: subscription.provider_subscription_id,
      current_period_start: subscription.current_period_start?.toISOString() ?? null,
      current_period_end: subscription.current_period_end?.toISOString() ?? null,
      trial_ends_at: subscription.trial_ends_at?.toISOString() ?? null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancelled_at: subscription.cancelled_at?.toISOString() ?? null,
    };
  }

  private formatInvoice(invoice: {
    id: string;
    invoice_number: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    currency: string;
    status: string;
    pdf_url: string | null;
    issued_at: Date;
    paid_at: Date | null;
  }) {
    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      discount: invoice.discount,
      total: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
      pdf_url: invoice.pdf_url,
      issued_at: invoice.issued_at.toISOString(),
      paid_at: invoice.paid_at?.toISOString() ?? null,
    };
  }

  async listPlans() {
    const plans = await this.repo.listPlans();
    return plans.map((plan) => this.formatPlan(plan));
  }

  async getSubscription(tenantId: string) {
    return this.formatSubscription(await this.repo.findCurrentSubscription(tenantId));
  }

  async subscribe(tenantId: string, dto: SubscribeDto, actor: AuthUser, meta?: AuditRequestMeta) {
    const plan = await this.repo.findPlanByCode(dto.plan_code);
    if (!plan || !plan.is_active) throw new NotFoundException('Plan not found');

    const amount = this.amountForPlan(plan, dto.billing_cycle);
    const providerResult =
      amount === 0
        ? {
            provider: 'manual',
            providerSubscriptionId: `manual_${tenantId}_${Date.now()}`,
            checkoutUrl: null,
          }
        : await this.provider().createSubscription({
            tenantId,
            planCode: plan.code,
            planName: plan.name,
            billingCycle: dto.billing_cycle,
            amount,
            currency: 'INR',
          });

    const now = new Date();
    const subscription = await this.repo.createOrReplaceSubscription({
      tenantId,
      planId: plan.id,
      planCode: plan.code,
      status: amount === 0 ? 'active' : 'trial',
      billingCycle: dto.billing_cycle,
      provider: providerResult.provider,
      providerSubscriptionId: providerResult.providerSubscriptionId,
      periodStart: now,
      periodEnd: this.addBillingPeriod(now, dto.billing_cycle),
      trialEndsAt: amount === 0 ? null : this.addDays(now, TRIAL_DAYS),
      actorId: actor.userId,
    });

    await this.audit.record({
      actor,
      tenantId,
      action: 'billing.subscription.created',
      entityType: 'subscription',
      entityId: subscription.id,
      afterState: { plan_code: plan.code, billing_cycle: dto.billing_cycle },
      meta,
    });

    if (subscription.trial_ends_at) {
      this.events.emit(DOMAIN_EVENTS.TRIAL_ENDING, {
        tenantId,
        actorUserId: actor.userId,
        entityType: 'subscription',
        entityId: subscription.id,
        delayMs: Math.max(subscription.trial_ends_at.getTime() - Date.now() - 3 * 24 * 60 * 60 * 1000, 0),
        context: {
          expiresAt: subscription.trial_ends_at.toISOString(),
          planName: plan.name,
        },
      });
    }

    return {
      subscription: this.formatSubscription({ ...subscription, plan }),
      checkout: {
        provider: providerResult.provider,
        subscription_id: providerResult.providerSubscriptionId,
        checkout_url: providerResult.checkoutUrl ?? null,
      },
    };
  }

  async changePlan(tenantId: string, dto: ChangePlanDto, actor: AuthUser, meta?: AuditRequestMeta) {
    const current = await this.repo.findCurrentSubscription(tenantId);
    if (!current) return this.subscribe(tenantId, dto, actor, meta);

    const plan = await this.repo.findPlanByCode(dto.plan_code);
    if (!plan || !plan.is_active) throw new NotFoundException('Plan not found');

    const now = new Date();
    const updated = await this.repo.updateSubscription({
      tenantId,
      subscriptionId: current.id,
      data: {
        plan: { connect: { id: plan.id } },
        billing_cycle: dto.billing_cycle,
        current_period_start: now,
        current_period_end: this.addBillingPeriod(now, dto.billing_cycle),
        cancel_at_period_end: false,
        status: 'active',
        updated_by: actor.userId,
      },
      orgStatus: 'active',
      orgTier: plan.code,
    });
    if (!updated) throw new NotFoundException('Subscription not found');

    await this.audit.record({
      actor,
      tenantId,
      action: 'billing.subscription.plan_changed',
      entityType: 'subscription',
      entityId: current.id,
      beforeState: { plan_code: current.plan.code, billing_cycle: current.billing_cycle },
      afterState: { plan_code: plan.code, billing_cycle: dto.billing_cycle },
      meta,
    });

    this.events.emit(DOMAIN_EVENTS.PLAN_CHANGED, {
      tenantId,
      actorUserId: actor.userId,
      entityType: 'subscription',
      entityId: current.id,
      context: {
        expiresAt: updated.current_period_end?.toISOString() ?? '',
        planName: plan.name,
      },
    });

    return this.formatSubscription(updated);
  }

  async cancel(tenantId: string, dto: CancelSubscriptionDto, actor: AuthUser, meta?: AuditRequestMeta) {
    const current = await this.repo.findCurrentSubscription(tenantId);
    if (!current) throw new NotFoundException('Subscription not found');

    const atPeriodEnd = dto.at_period_end ?? true;
    const updated = await this.repo.updateSubscription({
      tenantId,
      subscriptionId: current.id,
      data: {
        cancel_at_period_end: atPeriodEnd,
        cancelled_at: atPeriodEnd ? null : new Date(),
        status: atPeriodEnd ? current.status : 'cancelled',
        updated_by: actor.userId,
      },
      orgStatus: atPeriodEnd ? undefined : 'cancelled',
    });
    if (!updated) throw new NotFoundException('Subscription not found');

    await this.audit.record({
      actor,
      tenantId,
      action: 'billing.subscription.cancelled',
      entityType: 'subscription',
      entityId: current.id,
      afterState: { at_period_end: atPeriodEnd },
      meta,
    });

    return this.formatSubscription(updated);
  }

  async listInvoices(tenantId: string, query: ListInvoicesQueryDto = {}) {
    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const { rows, total } = await this.repo.listInvoices(tenantId, page, perPage);
    return {
      data: rows.map((invoice) => this.formatInvoice(invoice)),
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async getUsage(tenantId: string) {
    const org = await this.repo.findOrganization(tenantId);
    if (!org) throw new NotFoundException('Organization not found');
    const planCode = org.tier === 'basic' ? 'starter' : org.tier;
    const plan = await this.repo.findPlanByCode(planCode);
    if (!plan) throw new NotFoundException('Plan not found');

    const usage = org.organization_usage;
    return {
      plan: this.formatPlan(plan),
      usage: {
        properties: usage?.properties_count ?? 0,
        employees: usage?.employees_count ?? 0,
        storage_bytes: Number(usage?.storage_bytes ?? 0n),
        ai_minutes: usage?.ai_minutes_used ?? 0,
      },
      limits: {
        properties: plan.max_properties,
        employees: plan.max_employees,
        storage_bytes: Number(plan.storage_limit_bytes),
        ai_minutes: plan.max_ai_minutes_monthly,
      },
    };
  }

  async processRazorpayWebhook(
    dto: RazorpayWebhookDto,
    signature: string | undefined,
    rawBody?: Buffer,
  ) {
    const payload = rawBody ?? Buffer.from(JSON.stringify(dto));
    const valid = this.razorpayProvider.verifyWebhookSignature(payload, signature);
    if (!valid) throw new UnauthorizedException('Invalid Razorpay webhook signature');

    const providerEventId = dto.id ?? `${dto.event}:${JSON.stringify(dto.payload).slice(0, 64)}`;
    const existing = await this.repo.findWebhookEvent(providerEventId);
    if (existing?.processed_at) {
      return { processed: false, duplicate: true };
    }

    const event =
      existing ??
      (await this.repo.createWebhookEvent({
        provider: 'razorpay',
        providerEventId,
        eventType: dto.event,
        payload: dto as unknown as Prisma.InputJsonValue,
        signatureValid: true,
      }));

    try {
      await this.applyWebhookEvent(dto);
      await this.repo.markWebhookProcessed(event.id);
      return { processed: true, duplicate: Boolean(existing) };
    } catch (error) {
      await this.repo.markWebhookFailed(
        event.id,
        error instanceof Error ? error.message : 'Webhook processing failed',
      );
      throw error;
    }
  }

  private extractSubscriptionId(payload: Record<string, unknown>): string | null {
    const subscription = payload.subscription as { entity?: { id?: string } } | undefined;
    const payment = payload.payment as { entity?: { subscription_id?: string } } | undefined;
    return subscription?.entity?.id ?? payment?.entity?.subscription_id ?? null;
  }

  private extractPayment(payload: Record<string, unknown>) {
    const payment = payload.payment as
      | {
          entity?: {
            id?: string;
            amount?: number;
            method?: string;
            error_code?: string;
            error_description?: string;
          };
        }
      | undefined;
    return payment?.entity ?? {};
  }

  private async applyWebhookEvent(dto: RazorpayWebhookDto) {
    const providerSubscriptionId = this.extractSubscriptionId(dto.payload);
    if (!providerSubscriptionId) throw new BadRequestException('Webhook missing subscription id');

    const subscription = await this.repo.findSubscriptionByProviderId(providerSubscriptionId);
    if (!subscription) throw new NotFoundException('Subscription not found for webhook');

    if (
      dto.event === BILLING_EVENT_KEYS.PAYMENT_CAPTURED ||
      dto.event === BILLING_EVENT_KEYS.SUBSCRIPTION_CHARGED
    ) {
      await this.handlePaymentCaptured(subscription, dto);
      return;
    }

    if (dto.event === BILLING_EVENT_KEYS.PAYMENT_FAILED) {
      await this.handlePaymentFailed(subscription, dto);
      return;
    }

    if (
      dto.event === BILLING_EVENT_KEYS.SUBSCRIPTION_RENEWED ||
      dto.event === BILLING_EVENT_KEYS.SUBSCRIPTION_ACTIVATED
    ) {
      const now = new Date();
      await this.repo.updateSubscription({
        tenantId: subscription.tenant_id,
        subscriptionId: subscription.id,
        data: {
          status: 'active',
          current_period_start: now,
          current_period_end: this.addBillingPeriod(now, subscription.billing_cycle as BillingCycle),
        },
        orgStatus: 'active',
      });
      return;
    }

    if (dto.event === BILLING_EVENT_KEYS.SUBSCRIPTION_CANCELLED) {
      await this.repo.updateSubscription({
        tenantId: subscription.tenant_id,
        subscriptionId: subscription.id,
        data: { status: 'cancelled', cancelled_at: new Date(), cancel_at_period_end: false },
        orgStatus: 'cancelled',
      });
    }
  }

  private async handlePaymentCaptured(subscription: SubscriptionRow, dto: RazorpayWebhookDto) {
    const payment = this.extractPayment(dto.payload);
    const subtotal = this.amountForPlan(subscription.plan, subscription.billing_cycle as BillingCycle);
    const tax = this.money(subtotal * GST_RATE);
    const total = subtotal + tax;

    const invoice = await this.repo.createInvoice({
      tenantId: subscription.tenant_id,
      subscriptionId: subscription.id,
      planId: subscription.plan_id,
      invoiceNumber: this.invoiceNumber(subscription.tenant_id),
      subtotal,
      tax,
      discount: 0,
      total,
      status: 'paid',
      provider: 'razorpay',
      paidAt: new Date(),
    });

    await this.repo.createPayment({
      tenantId: subscription.tenant_id,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      provider: 'razorpay',
      providerPaymentId: payment.id,
      amount: payment.amount ?? total,
      status: 'captured',
      method: payment.method,
      metadata: dto as unknown as Prisma.InputJsonValue,
      paidAt: new Date(),
    });

    const now = new Date();
    await this.repo.updateSubscription({
      tenantId: subscription.tenant_id,
      subscriptionId: subscription.id,
      data: {
        status: 'active',
        current_period_start: now,
        current_period_end: this.addBillingPeriod(now, subscription.billing_cycle as BillingCycle),
      },
      orgStatus: 'active',
    });

    this.events.emit(DOMAIN_EVENTS.INVOICE_GENERATED, {
      tenantId: subscription.tenant_id,
      entityType: 'invoice',
      entityId: invoice.id,
      context: {
        expiresAt: invoice.issued_at.toISOString(),
        invoiceNumber: invoice.invoice_number,
        planName: subscription.plan.name,
      },
    });

    this.events.emit(DOMAIN_EVENTS.SUBSCRIPTION_RENEWED, {
      tenantId: subscription.tenant_id,
      entityType: 'subscription',
      entityId: subscription.id,
      context: {
        expiresAt: this.addBillingPeriod(
          new Date(),
          subscription.billing_cycle as BillingCycle,
        ).toISOString(),
        planName: subscription.plan.name,
      },
    });
  }

  private async handlePaymentFailed(subscription: SubscriptionRow, dto: RazorpayWebhookDto) {
    const payment = this.extractPayment(dto.payload);
    await this.repo.createPaymentAttempt({
      tenantId: subscription.tenant_id,
      subscriptionId: subscription.id,
      provider: 'razorpay',
      providerPaymentId: payment.id,
      providerSubscriptionId: subscription.provider_subscription_id,
      status: 'failed',
      amount: payment.amount ?? this.amountForPlan(subscription.plan, subscription.billing_cycle as BillingCycle),
      errorCode: payment.error_code,
      errorMessage: payment.error_description,
      metadata: dto as unknown as Prisma.InputJsonValue,
    });

    await this.repo.updateSubscription({
      tenantId: subscription.tenant_id,
      subscriptionId: subscription.id,
      data: { status: 'past_due' },
      orgStatus: 'past_due',
    });

    this.events.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
      tenantId: subscription.tenant_id,
      entityType: 'subscription',
      entityId: subscription.id,
      context: {
        expiresAt: subscription.current_period_end?.toISOString() ?? '',
        planName: subscription.plan.name,
      },
    });
  }

  async platformMetrics() {
    const { subscriptions, invoices, payments, plans } = await this.repo.platformBillingMetrics();
    const active = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial');
    const mrr = active.reduce((sum, s) => sum + s.plan.price_inr_monthly, 0);
    const paidRevenue = payments
      .filter((p) => p.status === 'captured')
      .reduce((sum, p) => sum + p.amount, 0);
    const churned = subscriptions.filter((s) => s.status === 'cancelled' || s.status === 'expired').length;
    const planDistribution = plans.map((plan) => ({
      plan_code: plan.code,
      count: subscriptions.filter((s) => s.plan_id === plan.id && !s.deleted_at).length,
    }));

    return {
      currency: 'INR',
      mrr,
      arr: mrr * 12,
      paid_revenue: paidRevenue,
      invoices: {
        total: invoices.length,
        paid: invoices.filter((i) => i.status === 'paid').length,
        failed: invoices.filter((i) => i.status === 'failed').length,
      },
      churn: {
        cancelled_subscriptions: churned,
        churn_rate: subscriptions.length ? Number(((churned / subscriptions.length) * 100).toFixed(2)) : 0,
      },
      plan_distribution: planDistribution,
      subscription_health: {
        active: active.length,
        past_due: subscriptions.filter((s) => s.status === 'past_due').length,
        suspended: subscriptions.filter((s) => s.status === 'suspended').length,
        cancelled: churned,
      },
    };
  }
}
