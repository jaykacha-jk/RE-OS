import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import type {
  PaymentProvider,
  ProviderSubscriptionRequest,
  ProviderSubscriptionResult,
} from './payment-provider';

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';

  async createSubscription(
    input: ProviderSubscriptionRequest,
  ): Promise<ProviderSubscriptionResult> {
    if (input.amount <= 0) {
      throw new Error('Razorpay subscriptions require a positive amount');
    }

    const plan = await this.request<RazorpayPlanResponse>('/plans', {
      period: input.billingCycle === 'yearly' ? 'yearly' : 'monthly',
      interval: 1,
      item: {
        name: `RE-OS ${input.planName} ${input.billingCycle}`,
        amount: input.amount,
        currency: input.currency,
        description: `${input.planName} plan for RE-OS`,
      },
      notes: {
        tenant_id: input.tenantId,
        plan_code: input.planCode,
        billing_cycle: input.billingCycle,
      },
    });

    if (!plan.id) {
      throw new Error('Razorpay plan creation did not return a plan id');
    }

    const subscription = await this.request<RazorpaySubscriptionResponse>(
      '/subscriptions',
      {
        plan_id: plan.id,
        total_count: input.billingCycle === 'yearly' ? 10 : 120,
        quantity: 1,
        customer_notify: 1,
        notes: {
          tenant_id: input.tenantId,
          plan_code: input.planCode,
          billing_cycle: input.billingCycle,
          provider_plan_id: plan.id,
        },
      },
    );

    if (!subscription.id) {
      throw new Error('Razorpay subscription creation did not return a subscription id');
    }
    if (!subscription.short_url) {
      throw new Error('Razorpay subscription creation did not return a checkout link');
    }

    return {
      provider: this.name,
      providerSubscriptionId: subscription.id,
      checkoutUrl: subscription.short_url,
      metadata: {
        tenantId: input.tenantId,
        planCode: input.planCode,
        billingCycle: input.billingCycle,
        providerPlanId: plan.id,
      },
    };
  }

  verifyWebhookSignature(payload: Buffer | string, signature: string | undefined): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new UnauthorizedException('Razorpay webhook secret is not configured');
    if (!signature) return false;

    const digest = createHmac('sha256', secret).update(payload).digest('hex');
    try {
      const digestBuffer = Buffer.from(digest, 'hex');
      const signatureBuffer = Buffer.from(signature, 'hex');
      return digestBuffer.length === signatureBuffer.length && timingSafeEqual(digestBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const keyId = this.requiredEnv('RAZORPAY_KEY_ID');
    const keySecret = this.requiredEnv('RAZORPAY_KEY_SECRET');
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as
      | (Record<string, unknown> & { error?: { description?: string; code?: string } })
      | null;

    if (!response.ok) {
      const message =
        payload?.error?.description ??
        payload?.error?.code ??
        `Razorpay API request failed with status ${response.status}`;
      throw new Error(message);
    }

    return payload as T;
  }

  private requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`${name} is required when PAYMENT_PROVIDER=razorpay`);
    }
    return value;
  }
}

type RazorpayPlanResponse = {
  id?: string;
};

type RazorpaySubscriptionResponse = {
  id?: string;
  short_url?: string;
};
