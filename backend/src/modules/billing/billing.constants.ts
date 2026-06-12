export const BILLING_PLAN_CODES = ['starter', 'pro', 'enterprise'] as const;
export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUSES = [
  'trial',
  'active',
  'past_due',
  'cancelled',
  'expired',
  'suspended',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'failed', 'void'] as const;
export const PAYMENT_STATUSES = ['created', 'captured', 'failed', 'refunded'] as const;

export const GST_RATE = 0.18;
export const TRIAL_DAYS = 14;

export const BILLING_EVENT_KEYS = {
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_FAILED: 'payment.failed',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_CHARGED: 'subscription.charged',
} as const;
