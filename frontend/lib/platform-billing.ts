import { apiFetch } from './api';
import { getSession } from './auth';

export type PlatformBillingMetrics = {
  currency: string;
  mrr: number;
  arr: number;
  paid_revenue: number;
  invoices: {
    total: number;
    paid: number;
    failed: number;
  };
  churn: {
    cancelled_subscriptions: number;
    churn_rate: number;
  };
  plan_distribution: Array<{ plan_code: string; count: number }>;
  subscription_health: {
    active: number;
    past_due: number;
    suspended: number;
    cancelled: number;
  };
};

export async function fetchPlatformBillingMetrics() {
  const session = getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return (
    await apiFetch<PlatformBillingMetrics>('/api/v1/platform/billing/metrics', {
      token: session.access_token,
    })
  ).data;
}
