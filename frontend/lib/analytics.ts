import { apiFetch } from './api';
import { getSession } from './auth';

// ===========================================================================
// Types (mirror backend AnalyticsService response shapes)
// ===========================================================================

export const ANALYTICS_RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'custom', label: 'Custom' },
] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]['value'];

export type RangeMeta = { range: string; from: string | null; to: string | null };

export type PropertyKpis = {
  total: number;
  active: number;
  published: number;
  reserved: number;
  sold: number;
  draft: number;
  by_status: Record<string, number>;
};

export type LeadKpis = {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  site_visits: number;
  won: number;
  lost: number;
  conversion_rate: number;
  by_stage: Record<string, number>;
};

export type RevenueKpis = {
  currency: string;
  won_deals: number;
  won_amount: number;
  avg_deal_value: number;
};

export type FunnelStep = { key: string; label: string; count: number };
export type SourceRow = { source: string; count: number };
export type MonthlyLead = { month: string; leads: number };
export type MonthlyConversion = {
  month: string;
  leads: number;
  won: number;
  conversion_rate: number;
};

export type EmployeePerformance = {
  employee_id: string;
  name: string;
  leads: number;
  won: number;
  lost: number;
  site_visits: number;
  conversion_rate: number;
};

export type DashboardData = {
  scope: 'all' | 'team' | 'assigned';
  range: RangeMeta;
  properties: PropertyKpis;
  leads: LeadKpis;
  revenue: RevenueKpis;
  funnel: FunnelStep[];
  sources: SourceRow[];
  monthly_leads: MonthlyLead[];
  monthly_conversion: MonthlyConversion[];
  employees: EmployeePerformance[];
  team_size: number;
  generated_at: string;
};

export type PlatformDashboardData = {
  range: RangeMeta;
  organizations: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    past_due: number;
  };
  revenue: { currency: string; mrr: number; arr: number };
  totals: { users: number; properties: number; leads: number };
  tier_breakdown: { tier: string; count: number }[];
  monthly_growth: { month: string; organizations: number }[];
  platform_health: { status: string; active_ratio: number };
  generated_at: string;
};

export type EmployeesData = { range: RangeMeta; employees: EmployeePerformance[] };

// ===========================================================================
// API client
// ===========================================================================

function rangeQuery(range: AnalyticsRange, from?: string, to?: string): string {
  const params = new URLSearchParams({ range });
  if (range === 'custom') {
    if (from) params.set('date_from', new Date(from).toISOString());
    if (to) params.set('date_to', new Date(to).toISOString());
  }
  return params.toString();
}

export async function fetchDashboard(
  range: AnalyticsRange = '30d',
  from?: string,
  to?: string,
): Promise<DashboardData> {
  const session = getSession();
  const res = await apiFetch<DashboardData>(
    `/api/v1/analytics/dashboard?${rangeQuery(range, from, to)}`,
    { token: session?.access_token },
  );
  return res.data;
}

export async function fetchPlatformDashboard(
  range: AnalyticsRange = '30d',
): Promise<PlatformDashboardData> {
  const session = getSession();
  const res = await apiFetch<PlatformDashboardData>(
    `/api/v1/platform/analytics/dashboard?${rangeQuery(range)}`,
    { token: session?.access_token },
  );
  return res.data;
}

export async function fetchEmployeePerformance(
  range: AnalyticsRange = '30d',
  from?: string,
  to?: string,
): Promise<EmployeesData> {
  const session = getSession();
  const res = await apiFetch<EmployeesData>(
    `/api/v1/analytics/employees?${rangeQuery(range, from, to)}`,
    { token: session?.access_token },
  );
  return res.data;
}

// ===========================================================================
// Formatting (Indian market defaults — INR, lakh/crore)
// ===========================================================================

export function formatInr(amount: number): string {
  if (!amount) return '₹0';
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${Math.round(amount)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function monthLabel(month: string): string {
  // month is "YYYY-MM"
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}
