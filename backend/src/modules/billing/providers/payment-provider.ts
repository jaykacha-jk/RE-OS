import type { BillingCycle } from '../billing.constants';

export type ProviderSubscriptionRequest = {
  tenantId: string;
  planCode: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  currency: 'INR';
};

export type ProviderSubscriptionResult = {
  provider: string;
  providerSubscriptionId: string;
  checkoutUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;

  createSubscription(input: ProviderSubscriptionRequest): Promise<ProviderSubscriptionResult>;

  verifyWebhookSignature(
    payload: Buffer | string,
    signature: string | undefined,
  ): boolean | Promise<boolean>;
}
