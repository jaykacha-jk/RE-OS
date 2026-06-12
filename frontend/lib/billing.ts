import { apiFetch } from './api';
import { getSession } from './auth';

export type BillingPlan = {
  id: string;
  code: 'starter' | 'pro' | 'enterprise';
  name: string;
  monthly_price: number;
  yearly_price: number | null;
  property_limit: number;
  employee_limit: number;
  storage_limit: number;
  features: Record<string, unknown>;
  is_active: boolean;
};

export type BillingSubscription = {
  id: string;
  plan: BillingPlan;
  status: string;
  billing_cycle: 'monthly' | 'yearly';
  provider: string;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  status: string;
  pdf_url: string | null;
  issued_at: string;
  paid_at: string | null;
};

export type BillingUsage = {
  plan: BillingPlan;
  usage: {
    properties: number;
    employees: number;
    storage_bytes: number;
    ai_minutes: number;
  };
  limits: {
    properties: number;
    employees: number;
    storage_bytes: number;
    ai_minutes: number;
  };
};

function token() {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.access_token;
}

export async function fetchPlans() {
  return (await apiFetch<BillingPlan[]>('/api/v1/billing/plans', { token: token() })).data;
}

export async function fetchSubscription() {
  return (await apiFetch<BillingSubscription | null>('/api/v1/billing/subscription', { token: token() })).data;
}

export async function subscribe(planCode: string, billingCycle: 'monthly' | 'yearly') {
  return (
    await apiFetch('/api/v1/billing/subscribe', {
      token: token(),
      method: 'POST',
      body: JSON.stringify({ plan_code: planCode, billing_cycle: billingCycle }),
    })
  ).data;
}

export async function changePlan(planCode: string, billingCycle: 'monthly' | 'yearly') {
  return (
    await apiFetch<BillingSubscription>('/api/v1/billing/change-plan', {
      token: token(),
      method: 'POST',
      body: JSON.stringify({ plan_code: planCode, billing_cycle: billingCycle }),
    })
  ).data;
}

export async function cancelSubscription(atPeriodEnd = true) {
  return (
    await apiFetch<BillingSubscription>('/api/v1/billing/cancel', {
      token: token(),
      method: 'POST',
      body: JSON.stringify({ at_period_end: atPeriodEnd }),
    })
  ).data;
}

export async function fetchInvoices() {
  return (await apiFetch<Invoice[]>('/api/v1/billing/invoices', { token: token() })).data;
}

export async function fetchUsage() {
  return (await apiFetch<BillingUsage>('/api/v1/billing/usage', { token: token() })).data;
}

export function formatMoney(paise: number | null | undefined) {
  if (!paise) return 'Custom';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function formatStorage(bytes: number) {
  if (!bytes) return 'Unlimited';
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
}

export function formatLimit(value: number) {
  return value >= 2147483647 ? 'Unlimited' : value.toLocaleString('en-IN');
}
