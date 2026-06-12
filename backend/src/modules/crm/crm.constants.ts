/**
 * Phase 3 — CRM / Inquiry Pipeline enumerations and constants.
 * Kept as const string unions to stay aligned with the String columns in Prisma
 * while enabling class-validator `@IsIn` checks. Pipeline stage transitions are
 * enforced in the service layer (BR-C02).
 */

// ===========================================================================
// Pipeline stages (fixed MVP pipeline)
// ===========================================================================

export const INQUIRY_STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SITE_VISIT_SCHEDULED',
  'SITE_VISIT_COMPLETED',
  'NEGOTIATION',
  'BOOKED',
  'CLOSED_WON',
  'CLOSED_LOST',
] as const;
export type InquiryStage = (typeof INQUIRY_STAGES)[number];

/** Ordered "happy path" of the pipeline (excludes terminal CLOSED_LOST). */
export const INQUIRY_STAGE_ORDER: InquiryStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SITE_VISIT_SCHEDULED',
  'SITE_VISIT_COMPLETED',
  'NEGOTIATION',
  'BOOKED',
  'CLOSED_WON',
];

export const INQUIRY_WON_STAGE: InquiryStage = 'CLOSED_WON';
export const INQUIRY_LOST_STAGE: InquiryStage = 'CLOSED_LOST';

export const INQUIRY_TERMINAL_STAGES: InquiryStage[] = ['CLOSED_WON', 'CLOSED_LOST'];

/**
 * Allowed forward transitions for non-privileged roles (BR-C02).
 * Any stage may move to CLOSED_LOST. Privileged roles (manager/admin) may jump
 * to any stage (the jump is recorded in history).
 */
export const INQUIRY_STAGE_TRANSITIONS: Record<InquiryStage, InquiryStage[]> = {
  NEW: ['CONTACTED', 'CLOSED_LOST'],
  CONTACTED: ['QUALIFIED', 'CLOSED_LOST'],
  QUALIFIED: ['SITE_VISIT_SCHEDULED', 'NEGOTIATION', 'CLOSED_LOST'],
  SITE_VISIT_SCHEDULED: ['SITE_VISIT_COMPLETED', 'CLOSED_LOST'],
  SITE_VISIT_COMPLETED: ['NEGOTIATION', 'SITE_VISIT_SCHEDULED', 'CLOSED_LOST'],
  NEGOTIATION: ['BOOKED', 'CLOSED_LOST'],
  BOOKED: ['CLOSED_WON', 'CLOSED_LOST'],
  CLOSED_WON: [],
  CLOSED_LOST: [],
};

// ===========================================================================
// Lead attributes
// ===========================================================================

export const INQUIRY_PRIORITIES = ['low', 'medium', 'high'] as const;
export type InquiryPriority = (typeof INQUIRY_PRIORITIES)[number];

export const INQUIRY_TEMPERATURES = ['hot', 'warm', 'cold'] as const;
export type InquiryTemperature = (typeof INQUIRY_TEMPERATURES)[number];

export const INQUIRY_REQUIREMENT_TYPES = ['buy', 'sell', 'rent'] as const;
export type InquiryRequirementType = (typeof INQUIRY_REQUIREMENT_TYPES)[number];

export const INQUIRY_PROPERTY_TYPES = ['residential', 'commercial'] as const;

export const INQUIRY_PURCHASE_TIMELINES = [
  'immediate',
  '1_3_months',
  '3_6_months',
  '6_12_months',
  'exploring',
] as const;

export const LEAD_SCORE_MIN = 0;
export const LEAD_SCORE_MAX = 100;

// ===========================================================================
// Follow-ups
// ===========================================================================

export const FOLLOWUP_TYPES = ['call', 'meeting', 'whatsapp', 'site_visit', 'email'] as const;
export type FollowupType = (typeof FOLLOWUP_TYPES)[number];

export const FOLLOWUP_STATUSES = ['pending', 'completed', 'missed', 'rescheduled'] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

// ===========================================================================
// Site visits
// ===========================================================================

export const SITE_VISIT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const;
export type SiteVisitStatus = (typeof SITE_VISIT_STATUSES)[number];

// ===========================================================================
// Activity / history change types
// ===========================================================================

export const INQUIRY_ACTIVITY_TYPES = {
  INQUIRY_CREATED: 'inquiry_created',
  INQUIRY_ASSIGNED: 'inquiry_assigned',
  STAGE_CHANGED: 'stage_changed',
  NOTE_ADDED: 'note_added',
  FOLLOWUP_CREATED: 'followup_created',
  SITE_VISIT_SCHEDULED: 'site_visit_scheduled',
  SITE_VISIT_COMPLETED: 'site_visit_completed',
  CLOSED_WON: 'closed_won',
  CLOSED_LOST: 'closed_lost',
} as const;

export const INQUIRY_HISTORY_TYPES = {
  CREATED: 'created',
  INQUIRY_UPDATED: 'inquiry_updated',
  STAGE_CHANGED: 'stage_changed',
  ASSIGNMENT_CHANGED: 'assignment_changed',
  CLOSED: 'closed',
} as const;

// ===========================================================================
// Sorting + RBAC scope roles
// ===========================================================================

export const INQUIRY_SORTABLE_FIELDS = [
  'created_at',
  'updated_at',
  'stage',
  'priority',
  'lead_score',
  'client_name',
] as const;
export type InquirySortableField = (typeof INQUIRY_SORTABLE_FIELDS)[number];

/** Roles that may see every inquiry in the tenant. */
export const CRM_FULL_ACCESS_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
];

/** Roles scoped to "team" inquiries (self + direct reports). */
export const CRM_TEAM_ACCESS_ROLES = ['sales_manager'];

/** Roles allowed to jump pipeline stages out of order (BR-C02). */
export const CRM_STAGE_JUMP_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
  'sales_manager',
];

/** Roles allowed to see all sensitive CRM lead fields. */
export const CRM_FULL_PII_ACCESS_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
  'sales_manager',
];

/** Assigned daily drivers may see operational lead detail, but not tenant-wide PII. */
export const CRM_OPERATIONAL_PII_ACCESS_ROLES = [
  ...CRM_FULL_PII_ACCESS_ROLES,
  'sales_executive',
];

/** Telecallers need dialable contact data, but not financial/internal CRM details. */
export const CRM_CONTACT_PII_ACCESS_ROLES = [
  ...CRM_OPERATIONAL_PII_ACCESS_ROLES,
  'telecaller',
];

/** Duplicate-detection window in days (BR-C01). */
export const INQUIRY_DUPLICATE_WINDOW_DAYS = 30;

export const INQUIRY_CLIENT_NAME_MAX = 120;
