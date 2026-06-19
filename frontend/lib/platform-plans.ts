import { apiFetch } from './api';
import { getSession } from './auth';
import type { BillingPlan } from './billing';

export type PlatformPlan = BillingPlan & {
  ai_minutes_limit?: number;
  active_subscriptions?: number;
};

function token() {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session.access_token;
}

export async function fetchPlatformPlans() {
  return (await apiFetch<PlatformPlan[]>('/api/v1/platform/plans', { token: token() })).data;
}

export async function createPlatformPlan(body: Record<string, unknown>) {
  return (await apiFetch<PlatformPlan>('/api/v1/platform/plans', {
    token: token(),
    method: 'POST',
    body: JSON.stringify(body),
  })).data;
}

export async function updatePlatformPlan(id: string, body: Record<string, unknown>) {
  return (await apiFetch<PlatformPlan>(`/api/v1/platform/plans/${id}`, {
    token: token(),
    method: 'PATCH',
    body: JSON.stringify(body),
  })).data;
}

/** Convert rupees entered in the UI to paise for the API. */
export function rupeesToPaise(rupees: string): number {
  const value = Number(rupees);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

/** Convert paise from the API to rupees for form fields. */
export function paiseToRupees(paise: number | null | undefined): string {
  if (paise == null) return '';
  return String(paise / 100);
}

export function defaultPlanFeaturesJson() {
  return JSON.stringify(
    { crm: true, dashboard: true, notifications: true, chat: true, ai: false },
    null,
    2,
  );
}
