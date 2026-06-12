/**
 * Phase 2 — Property domain enumerations and constants.
 * Kept as const string unions to stay aligned with the String columns in Prisma
 * while enabling class-validator `@IsIn` checks.
 */

export const PROPERTY_TYPES = ['residential', 'commercial'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_CATEGORIES = [
  'flat',
  'villa',
  'plot',
  'office',
  'shop',
  'warehouse',
] as const;
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export const PROPERTY_REQUIREMENT_TYPES = ['buy', 'sell', 'rent'] as const;
export type PropertyRequirementType = (typeof PROPERTY_REQUIREMENT_TYPES)[number];

export const PROPERTY_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'reserved',
  'sold',
  'archived',
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

/**
 * Allowed status transitions for the property workflow.
 * Enforced in the service layer (BR-P0x style guard).
 */
export const PROPERTY_STATUS_TRANSITIONS: Record<PropertyStatus, PropertyStatus[]> = {
  draft: ['pending_review', 'published', 'archived'],
  pending_review: ['published', 'draft', 'archived'],
  published: ['reserved', 'sold', 'archived', 'draft'],
  reserved: ['published', 'sold', 'archived'],
  sold: ['archived'],
  archived: ['draft'],
};

export const PROPERTY_HISTORY_TYPES = {
  CREATED: 'created',
  PROPERTY_UPDATED: 'property_updated',
  PRICE_CHANGED: 'price_changed',
  STATUS_CHANGED: 'status_changed',
  ASSIGNMENT_CHANGED: 'assignment_changed',
} as const;

export const PROPERTY_SORTABLE_FIELDS = [
  'created_at',
  'updated_at',
  'price',
  'title',
  'status',
  'city',
] as const;
export type PropertySortableField = (typeof PROPERTY_SORTABLE_FIELDS)[number];

/** Roles that may see every property in the tenant. */
export const PROPERTY_FULL_ACCESS_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
  'marketing_user',
];

/** Roles scoped to "team" properties (self + direct reports). */
export const PROPERTY_TEAM_ACCESS_ROLES = ['sales_manager'];

export const PROPERTY_TITLE_MAX = 200;
