/**
 * Phase 6 — Live Chat & Omnichannel Foundation enumerations and constants.
 *
 * Kept as const string unions (mirrors crm.constants / notifications.constants)
 * to align with the String columns in Prisma while enabling class-validator
 * `@IsIn` checks. Conversation status transitions are enforced in the service
 * layer. Strings (not enums) keep the door open for future WhatsApp / AI-agent
 * channels and message types without a schema migration.
 */

// ===========================================================================
// Conversation types & status
// ===========================================================================

export const CONVERSATION_TYPES = [
  'website',
  'inquiry',
  'property',
  'support',
  'internal',
] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const CONVERSATION_STATUSES = [
  'open',
  'assigned',
  'waiting',
  'closed',
  'archived',
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/** Statuses considered "active" (count toward agent workload + unread). */
export const CONVERSATION_OPEN_STATUSES: ConversationStatus[] = [
  'open',
  'assigned',
  'waiting',
];

export const CONVERSATION_CLOSED_STATUSES: ConversationStatus[] = [
  'closed',
  'archived',
];

// ===========================================================================
// Messages
// ===========================================================================

export const MESSAGE_TYPES = ['text', 'image', 'file', 'system'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_STATUSES = ['sent', 'delivered', 'read', 'failed'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const SENDER_TYPES = ['employee', 'client', 'system'] as const;
export type SenderType = (typeof SENDER_TYPES)[number];

export const PARTICIPANT_TYPES = ['employee', 'client', 'system'] as const;
export type ParticipantType = (typeof PARTICIPANT_TYPES)[number];

export const MESSAGE_CONTENT_MAX = 8000;
export const CONVERSATION_SUBJECT_MAX = 200;

// ===========================================================================
// Attachments
// ===========================================================================

export const ATTACHMENT_KINDS = ['image', 'file', 'document'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

/** Allowed attachment content types (reuse property S3 abstraction). */
export const ALLOWED_ATTACHMENT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

/** Max decoded attachment size (10 MB). */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

// ===========================================================================
// Activity types
// ===========================================================================

export const CONVERSATION_ACTIVITY_TYPES = {
  CONVERSATION_CREATED: 'conversation_created',
  CONVERSATION_ASSIGNED: 'conversation_assigned',
  CONVERSATION_CLOSED: 'conversation_closed',
  CONVERSATION_REOPENED: 'conversation_reopened',
  CONVERTED_TO_INQUIRY: 'converted_to_inquiry',
  STATUS_CHANGED: 'status_changed',
  TAG_ADDED: 'tag_added',
  PARTICIPANT_JOINED: 'participant_joined',
} as const;

// ===========================================================================
// Sorting + RBAC scope roles
// ===========================================================================

export const CONVERSATION_SORTABLE_FIELDS = [
  'last_message_at',
  'created_at',
  'updated_at',
  'status',
] as const;
export type ConversationSortableField =
  (typeof CONVERSATION_SORTABLE_FIELDS)[number];

/** Roles that may see every conversation in the tenant. */
export const CHAT_FULL_ACCESS_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
];

/** Roles scoped to "team" conversations (self + direct reports). */
export const CHAT_TEAM_ACCESS_ROLES = ['sales_manager'];

/** Roles allowed to assign / reassign conversations. */
export const CHAT_ASSIGN_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
  'sales_manager',
];

export const CONVERSATION_DEFAULT_PER_PAGE = 20;
export const CONVERSATION_MAX_PER_PAGE = 100;
export const MESSAGE_DEFAULT_PER_PAGE = 50;
export const MESSAGE_MAX_PER_PAGE = 100;
