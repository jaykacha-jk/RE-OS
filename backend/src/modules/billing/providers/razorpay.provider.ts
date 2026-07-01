import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PlatformPaymentConfigService } from '../../platform-settings/platform-payment-config.service';
import type {
  PaymentProvider,
  ProviderSubscriptionRequest,
  ProviderSubscriptionResult,
} from './payment-provider';

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';

  constructor(private readonly paymentConfig: PlatformPaymentConfigService) {}

  async createSubscription(
    input: ProviderSubscriptionRequest,
  ): Promise<ProviderSubscriptionResult> {
    if (input.amount <= 0) {
      throw new Error('Razorpay subscriptions require a positive amount');
    }

    const credentials = await this.resolveCredentials();
    if (!credentials) {
      throw new Error('Razorpay credentials are not configured');
    }

    const plan = await this.request<RazorpayPlanResponse>(
      '/plans',
      {
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
      },
      credentials,
    );

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
      credentials,
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

  async verifyWebhookSignature(
    payload: Buffer | string,
    signature: string | undefined,
  ): Promise<boolean> {
    const credentials = await this.resolveCredentials();
    const secret = credentials?.webhookSecret?.trim();
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

  private async resolveCredentials() {
    return this.paymentConfig.getActiveRazorpayCredentials();
  }

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
    credentials: { keyId: string; keySecret: string },
  ): Promise<T> {
    const auth = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64');

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
}

type RazorpayPlanResponse = {
  id?: string;
};

type RazorpaySubscriptionResponse = {
  id?: string;
  short_url?: string;
};
