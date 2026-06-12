import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

const subscriptionInclude = {
  plan: true,
} satisfies Prisma.subscriptionsInclude;

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    return this.prisma.dbClient.subscription_plans.findMany({
      where: { is_active: true },
      orderBy: { price_inr_monthly: 'asc' },
    });
  }

  async findPlanByCode(code: string) {
    return this.prisma.dbClient.subscription_plans.findUnique({ where: { code } });
  }

  async findOrganization(tenantId: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { id: tenantId, deleted_at: null },
      include: { organization_usage: true },
    });
  }

  async findCurrentSubscription(tenantId: string) {
    return this.prisma.dbClient.subscriptions.findFirst({
      where: { tenant_id: tenantId, deleted_at: null },
      include: subscriptionInclude,
      orderBy: { created_at: 'desc' },
    });
  }

  async createOrReplaceSubscription(input: {
    tenantId: string;
    planId: string;
    planCode: string;
    status: string;
    billingCycle: string;
    provider: string;
    providerSubscriptionId: string;
    periodStart: Date;
    periodEnd: Date;
    trialEndsAt?: Date | null;
    actorId?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      await tx.subscriptions.updateMany({
        where: { tenant_id: input.tenantId, deleted_at: null },
        data: { deleted_at: new Date(), updated_by: input.actorId ?? null },
      });

      const subscription = await tx.subscriptions.create({
        data: {
          tenant_id: input.tenantId,
          plan_id: input.planId,
          status: input.status,
          billing_cycle: input.billingCycle,
          provider: input.provider,
          provider_subscription_id: input.providerSubscriptionId,
          current_period_start: input.periodStart,
          current_period_end: input.periodEnd,
          trial_ends_at: input.trialEndsAt ?? null,
          created_by: input.actorId ?? null,
          updated_by: input.actorId ?? null,
        },
      });

      await tx.organizations.updateMany({
        where: { id: input.tenantId, deleted_at: null },
        data: {
          tier: input.planCode,
          status: input.status === 'trial' ? 'trial' : 'active',
        },
      });

      return subscription;
    });
  }

  async updateSubscription(input: {
    tenantId: string;
    subscriptionId: string;
    data: Prisma.subscriptionsUpdateInput;
    orgStatus?: string;
    orgTier?: string;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const result = await tx.subscriptions.updateMany({
        where: { id: input.subscriptionId, tenant_id: input.tenantId, deleted_at: null },
        data: input.data,
      });
      if (result.count !== 1) return null;
      const subscription = await tx.subscriptions.findFirst({
        where: { id: input.subscriptionId, tenant_id: input.tenantId, deleted_at: null },
        include: subscriptionInclude,
      });
      if (input.orgStatus || input.orgTier) {
        await tx.organizations.updateMany({
          where: { id: input.tenantId, deleted_at: null },
          data: {
            ...(input.orgStatus ? { status: input.orgStatus } : {}),
            ...(input.orgTier ? { tier: input.orgTier } : {}),
          },
        });
      }
      return subscription;
    });
  }

  async createInvoice(input: {
    tenantId: string;
    subscriptionId: string;
    planId: string;
    invoiceNumber: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    status: string;
    provider: string;
    providerInvoiceId?: string | null;
    paidAt?: Date | null;
    actorId?: string | null;
  }) {
    return this.prisma.dbClient.invoices.create({
      data: {
        tenant_id: input.tenantId,
        subscription_id: input.subscriptionId,
        plan_id: input.planId,
        invoice_number: input.invoiceNumber,
        subtotal: input.subtotal,
        tax: input.tax,
        discount: input.discount,
        total: input.total,
        status: input.status,
        provider: input.provider,
        provider_invoice_id: input.providerInvoiceId ?? null,
        paid_at: input.paidAt ?? null,
        created_by: input.actorId ?? null,
        updated_by: input.actorId ?? null,
      },
    });
  }

  async listInvoices(tenantId: string, page = 1, perPage = 20) {
    const where: Prisma.invoicesWhereInput = { tenant_id: tenantId, deleted_at: null };
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.invoices.findMany({
        where,
        orderBy: { issued_at: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.dbClient.invoices.count({ where }),
    ]);
    return { rows, total };
  }

  async createPayment(input: {
    tenantId: string;
    subscriptionId: string;
    invoiceId?: string | null;
    provider: string;
    providerPaymentId?: string | null;
    amount: number;
    status: string;
    method?: string | null;
    metadata?: Prisma.InputJsonValue;
    paidAt?: Date | null;
  }) {
    return this.prisma.dbClient.payments.create({
      data: {
        tenant_id: input.tenantId,
        subscription_id: input.subscriptionId,
        invoice_id: input.invoiceId ?? null,
        provider: input.provider,
        provider_payment_id: input.providerPaymentId ?? null,
        amount: input.amount,
        status: input.status,
        method: input.method ?? null,
        metadata: input.metadata ?? {},
        paid_at: input.paidAt ?? null,
      },
    });
  }

  async createPaymentAttempt(input: {
    tenantId: string;
    subscriptionId: string;
    provider: string;
    providerPaymentId?: string | null;
    providerSubscriptionId?: string | null;
    status: string;
    amount: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.dbClient.payment_attempts.create({
      data: {
        tenant_id: input.tenantId,
        subscription_id: input.subscriptionId,
        provider: input.provider,
        provider_payment_id: input.providerPaymentId ?? null,
        provider_subscription_id: input.providerSubscriptionId ?? null,
        status: input.status,
        amount: input.amount,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
        metadata: input.metadata ?? {},
      },
    });
  }

  async findWebhookEvent(providerEventId: string) {
    return this.prisma.dbClient.billing_webhook_events.findUnique({
      where: { provider_event_id: providerEventId },
    });
  }

  async createWebhookEvent(input: {
    provider: string;
    providerEventId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
    signatureValid: boolean;
  }) {
    return this.prisma.dbClient.billing_webhook_events.create({
      data: {
        provider: input.provider,
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        payload: input.payload,
        signature_valid: input.signatureValid,
      },
    });
  }

  async markWebhookProcessed(id: string, error?: string | null) {
    return this.prisma.dbClient.billing_webhook_events.update({
      where: { id },
      data: {
        processed_at: new Date(),
        processing_error: error ?? null,
      },
    });
  }

  async markWebhookFailed(id: string, error: string) {
    return this.prisma.dbClient.billing_webhook_events.update({
      where: { id },
      data: {
        processing_error: error,
      },
    });
  }

  async findSubscriptionByProviderId(providerSubscriptionId: string) {
    return this.prisma.dbClient.subscriptions.findFirst({
      where: { provider_subscription_id: providerSubscriptionId, deleted_at: null },
      include: subscriptionInclude,
    });
  }

  async platformBillingMetrics() {
    const [subscriptions, invoices, payments, planRows] = await Promise.all([
      this.prisma.dbClient.subscriptions.findMany({
        where: { deleted_at: null },
        include: { plan: true },
      }),
      this.prisma.dbClient.invoices.findMany({ where: { deleted_at: null } }),
      this.prisma.dbClient.payments.findMany({ where: { deleted_at: null } }),
      this.prisma.dbClient.subscription_plans.findMany({ where: { is_active: true } }),
    ]);

    return { subscriptions, invoices, payments, plans: planRows };
  }
}
