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
];

/** Roles scoped to "team" properties (self + direct reports). */
export const PROPERTY_TEAM_ACCESS_ROLES = ['sales_manager'];

export const PROPERTY_TITLE_MAX = 200;

/** Allowed image content types for property image uploads (server-enforced). */
export const ALLOWED_PROPERTY_IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Max decoded property image size (10 MB). */
export const PROPERTY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Allowed video content types for property video uploads (server-enforced). */
export const ALLOWED_PROPERTY_VIDEO_CONTENT_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

/** Max decoded property video size (50 MB). */
export const PROPERTY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/** Bulk CSV import row cap (BR-P05). */
export const PROPERTY_CSV_MAX_ROWS = 500;

/** Required CSV column headers (case-insensitive). */
export const PROPERTY_CSV_REQUIRED_HEADERS = [
  'title',
  'type',
  'category',
  'requirement_type',
  'city',
] as const;
