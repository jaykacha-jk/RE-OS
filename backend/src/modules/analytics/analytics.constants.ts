/**
 * Phase 4 — Dashboard & Analytics constants.
 *
 * Reuses the fixed CRM pipeline + property status vocabulary. No new core tables
 * are introduced; analytics is computed from optimized aggregate queries over
 * `properties`, `inquiries`, `site_visits`, `employees`, and `organizations`.
 */

import { INQUIRY_STAGE_ORDER, type InquiryStage } from '../crm/crm.constants';

// ===========================================================================
// RBAC scope (mirrors CRM scope rules — RBAC.md §4 Dashboard & Analytics)
// ===========================================================================

/** Roles that see organization-wide analytics. */
export const ANALYTICS_FULL_ACCESS_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
  'marketing_user',
];

/** Roles scoped to "team" analytics (self + direct reports). */
export const ANALYTICS_TEAM_ACCESS_ROLES = ['sales_manager'];

/** Roles allowed to view the cross-employee performance table. */
export const ANALYTICS_PERFORMANCE_VIEW_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
  'marketing_user',
  'sales_manager',
];

export type AnalyticsScopeType = 'all' | 'team' | 'assigned';

// ===========================================================================
// Time ranges
// ===========================================================================

export const ANALYTICS_TIME_RANGES = ['today', '7d', '30d', '90d', 'custom'] as const;
export type AnalyticsTimeRange = (typeof ANALYTICS_TIME_RANGES)[number];
export const ANALYTICS_DEFAULT_RANGE: AnalyticsTimeRange = '30d';

// ===========================================================================
// Funnel definition (lead funnel chart)
// ===========================================================================

/**
 * Funnel buckets shown on the dashboard. Each bucket is "this stage or beyond"
 * along the happy path so the funnel is monotonically non-increasing.
 */
export const FUNNEL_STEPS: { key: string; label: string; stage: InquiryStage }[] = [
  { key: 'new', label: 'New', stage: 'NEW' },
  { key: 'contacted', label: 'Contacted', stage: 'CONTACTED' },
  { key: 'qualified', label: 'Qualified', stage: 'QUALIFIED' },
  { key: 'visit', label: 'Site Visit', stage: 'SITE_VISIT_SCHEDULED' },
  { key: 'negotiation', label: 'Negotiation', stage: 'NEGOTIATION' },
  { key: 'won', label: 'Won', stage: 'CLOSED_WON' },
];

/** Index of every stage on the happy path (used to compute "stage or beyond"). */
export const STAGE_RANK: Record<string, number> = INQUIRY_STAGE_ORDER.reduce(
  (acc, stage, index) => {
    acc[stage] = index;
    return acc;
  },
  {} as Record<string, number>,
);

/** Qualified+ stages (used for the "qualified leads" KPI). */
export const QUALIFIED_PLUS_STAGES: InquiryStage[] = [
  'QUALIFIED',
  'SITE_VISIT_SCHEDULED',
  'SITE_VISIT_COMPLETED',
  'NEGOTIATION',
  'BOOKED',
  'CLOSED_WON',
];

// ===========================================================================
// Property status vocabulary (snapshot KPIs)
// ===========================================================================

export const PROPERTY_STATUS_KEYS = [
  'draft',
  'pending_review',
  'published',
  'reserved',
  'sold',
  'archived',
] as const;

/** Statuses considered "active" inventory (live or under deal). */
export const PROPERTY_ACTIVE_STATUSES = ['published', 'reserved'];

// ===========================================================================
// Caching
// ===========================================================================

/** Default analytics cache TTL (ms). Swappable for Redis in production. */
export const ANALYTICS_CACHE_TTL_MS = 60_000;

export const CURRENCY = 'INR';

/** Sentinel used to force an empty result set when a scope resolves to no employees. */
export const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';
