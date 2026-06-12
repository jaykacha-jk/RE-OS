import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

import type {
  PaymentProvider,
  ProviderSubscriptionRequest,
  ProviderSubscriptionResult,
} from './payment-provider';

@Injectable()
export class MockProvider implements PaymentProvider {
  readonly name = 'mock';

  async createSubscription(
    input: ProviderSubscriptionRequest,
  ): Promise<ProviderSubscriptionResult> {
    const id = `mock_sub_${randomBytes(8).toString('hex')}`;
    return {
      provider: this.name,
      providerSubscriptionId: id,
      checkoutUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/settings/billing?mock_subscription=${id}`,
      metadata: {
        tenantId: input.tenantId,
        planCode: input.planCode,
        billingCycle: input.billingCycle,
      },
    };
  }

  verifyWebhookSignature(): boolean {
    return process.env.NODE_ENV !== 'production';
  }
}
