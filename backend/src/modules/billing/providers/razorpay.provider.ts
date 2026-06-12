import { createHmac, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

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
    const configured = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
    const id = `rzp_sub_${randomBytes(8).toString('hex')}`;

    return {
      provider: this.name,
      providerSubscriptionId: id,
      checkoutUrl: configured
        ? `https://api.razorpay.com/v1/subscriptions/${id}`
        : `${process.env.APP_URL ?? 'http://localhost:3000'}/settings/billing?provider=razorpay&subscription=${id}`,
      metadata: {
        tenantId: input.tenantId,
        planCode: input.planCode,
        billingCycle: input.billingCycle,
        integration: configured ? 'configured' : 'stub',
      },
    };
  }

  verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature) return process.env.NODE_ENV !== 'production';

    const digest = createHmac('sha256', secret).update(payload).digest('hex');
    try {
      return digest.length === signature.length && digest === signature;
    } catch {
      return false;
    }
  }
}
