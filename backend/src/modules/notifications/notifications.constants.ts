/**
 * Phase 5 — Notifications & Automation Engine constants.
 *
 * Enumerations kept as const string unions to align with the String columns in
 * Prisma while enabling class-validator `@IsIn` checks (mirrors crm.constants).
 */

import { DOMAIN_EVENTS, type DomainEventKey } from '../../events/domain-events';

// ===========================================================================
// Categories / priorities / channels
// ===========================================================================

export const NOTIFICATION_TYPES = [
  'SYSTEM',
  'CRM',
  'PROPERTY',
  'BILLING',
  'CHAT',
  'AI_AGENT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

// ===========================================================================
// RBAC scope roles (who can view what)
// ===========================================================================

/** Roles permitted to manage notification templates (admin APIs). */
export const NOTIFICATION_TEMPLATE_ADMIN_ROLES = [
  'super_admin',
  'org_owner',
  'org_admin',
];

/** Roles that receive billing notifications by default. */
export const ORG_ADMIN_ROLES = ['org_owner', 'org_admin'];

// ===========================================================================
// Recipient resolution strategies for automation rules
// ===========================================================================

export type RecipientStrategy =
  | 'assigned_employee' // resolve assigned employee's user from context.employeeId
  | 'manager' // manager (user) of the assigned employee
  | 'org_admins' // all org owners/admins in the tenant
  | 'actor' // the user who triggered the event
  | 'explicit'; // payload.recipientUserIds

export interface AutomationRule {
  event: DomainEventKey;
  type: NotificationType;
  priority: NotificationPriority;
  /** Channels attempted (subject to per-user preferences). */
  channels: NotificationChannel[];
  /** Who to notify. Multiple strategies are unioned + de-duplicated. */
  recipients: RecipientStrategy[];
  /** Don't notify the actor about their own action. */
  excludeActor: boolean;
  /** Human label (settings UI / preferences grouping). */
  label: string;
}

/**
 * Configurable automation rules. Each important domain event maps to a
 * notification spec. Editable here (and overridable per-tenant via templates).
 */
export const AUTOMATION_RULES: Record<DomainEventKey, AutomationRule> = {
  [DOMAIN_EVENTS.INQUIRY_CREATED]: {
    event: DOMAIN_EVENTS.INQUIRY_CREATED,
    type: 'CRM',
    priority: 'MEDIUM',
    channels: ['in_app', 'email'],
    recipients: ['org_admins'],
    excludeActor: true,
    label: 'New inquiry',
  },
  [DOMAIN_EVENTS.LEAD_ASSIGNED]: {
    event: DOMAIN_EVENTS.LEAD_ASSIGNED,
    type: 'CRM',
    priority: 'HIGH',
    channels: ['in_app', 'email'],
    recipients: ['assigned_employee'],
    excludeActor: true,
    label: 'Lead assigned to me',
  },
  [DOMAIN_EVENTS.FOLLOWUP_DUE]: {
    event: DOMAIN_EVENTS.FOLLOWUP_DUE,
    type: 'CRM',
    priority: 'HIGH',
    channels: ['in_app', 'email'],
    recipients: ['assigned_employee'],
    excludeActor: false,
    label: 'Follow-up due',
  },
  [DOMAIN_EVENTS.FOLLOWUP_MISSED]: {
    event: DOMAIN_EVENTS.FOLLOWUP_MISSED,
    type: 'CRM',
    priority: 'CRITICAL',
    channels: ['in_app', 'email'],
    recipients: ['assigned_employee', 'manager'],
    excludeActor: false,
    label: 'Follow-up missed',
  },
  [DOMAIN_EVENTS.SITE_VISIT_SCHEDULED]: {
    event: DOMAIN_EVENTS.SITE_VISIT_SCHEDULED,
    type: 'CRM',
    priority: 'MEDIUM',
    channels: ['in_app', 'email'],
    recipients: ['assigned_employee'],
    excludeActor: true,
    label: 'Site visit scheduled',
  },
  [DOMAIN_EVENTS.SITE_VISIT_REMINDER]: {
    event: DOMAIN_EVENTS.SITE_VISIT_REMINDER,
    type: 'CRM',
    priority: 'HIGH',
    channels: ['in_app', 'email'],
    recipients: ['assigned_employee'],
    excludeActor: false,
    label: 'Site visit reminder',
  },
  [DOMAIN_EVENTS.PROPERTY_ASSIGNED]: {
    event: DOMAIN_EVENTS.PROPERTY_ASSIGNED,
    type: 'PROPERTY',
    priority: 'MEDIUM',
    channels: ['in_app', 'email'],
    recipients: ['assigned_employee'],
    excludeActor: true,
    label: 'Property assigned to me',
  },
  [DOMAIN_EVENTS.PROPERTY_STATUS_CHANGED]: {
    event: DOMAIN_EVENTS.PROPERTY_STATUS_CHANGED,
    type: 'PROPERTY',
    priority: 'LOW',
    channels: ['in_app'],
    recipients: ['assigned_employee'],
    excludeActor: true,
    label: 'Property status changed',
  },
  [DOMAIN_EVENTS.SUBSCRIPTION_EXPIRING]: {
    event: DOMAIN_EVENTS.SUBSCRIPTION_EXPIRING,
    type: 'BILLING',
    priority: 'CRITICAL',
    channels: ['in_app', 'email'],
    recipients: ['org_admins'],
    excludeActor: false,
    label: 'Subscription expiring',
  },
  [DOMAIN_EVENTS.TRIAL_ENDING]: {
    event: DOMAIN_EVENTS.TRIAL_ENDING,
    type: 'BILLING',
    priority: 'HIGH',
    channels: ['in_app', 'email'],
    recipients: ['org_admins'],
    excludeActor: false,
    label: 'Trial ending',
  },
  [DOMAIN_EVENTS.PAYMENT_FAILED]: {
    event: DOMAIN_EVENTS.PAYMENT_FAILED,
    type: 'BILLING',
    priority: 'CRITICAL',
    channels: ['in_app', 'email'],
    recipients: ['org_admins'],
    excludeActor: false,
    label: 'Payment failed',
  },
  [DOMAIN_EVENTS.INVOICE_GENERATED]: {
    event: DOMAIN_EVENTS.INVOICE_GENERATED,
    type: 'BILLING',
    priority: 'MEDIUM',
    channels: ['in_app', 'email'],
    recipients: ['org_admins'],
    excludeActor: false,
    label: 'Invoice generated',
  },
  [DOMAIN_EVENTS.SUBSCRIPTION_RENEWED]: {
    event: DOMAIN_EVENTS.SUBSCRIPTION_RENEWED,
    type: 'BILLING',
    priority: 'MEDIUM',
    channels: ['in_app', 'email'],
    recipients: ['org_admins'],
    excludeActor: false,
    label: 'Subscription renewed',
  },
  [DOMAIN_EVENTS.PLAN_CHANGED]: {
    event: DOMAIN_EVENTS.PLAN_CHANGED,
    type: 'BILLING',
    priority: 'MEDIUM',
    channels: ['in_app', 'email'],
    recipients: ['org_admins'],
    excludeActor: true,
    label: 'Plan changed',
  },
  [DOMAIN_EVENTS.CONVERSATION_CREATED]: {
    event: DOMAIN_EVENTS.CONVERSATION_CREATED,
    type: 'CHAT',
    priority: 'MEDIUM',
    channels: ['in_app', 'email'],
    recipients: ['org_admins'],
    excludeActor: true,
    label: 'New conversation',
  },
  [DOMAIN_EVENTS.CONVERSATION_ASSIGNED]: {
    event: DOMAIN_EVENTS.CONVERSATION_ASSIGNED,
    type: 'CHAT',
    priority: 'HIGH',
    channels: ['in_app', 'email'],
    recipients: ['assigned_employee'],
    excludeActor: true,
    label: 'Conversation assigned to me',
  },
  [DOMAIN_EVENTS.CONVERSATION_CLOSED]: {
    event: DOMAIN_EVENTS.CONVERSATION_CLOSED,
    type: 'CHAT',
    priority: 'LOW',
    channels: ['in_app'],
    recipients: ['assigned_employee'],
    excludeActor: true,
    label: 'Conversation closed',
  },
  [DOMAIN_EVENTS.MESSAGE_RECEIVED]: {
    event: DOMAIN_EVENTS.MESSAGE_RECEIVED,
    type: 'CHAT',
    priority: 'HIGH',
    channels: ['in_app'],
    recipients: ['explicit'],
    excludeActor: true,
    label: 'New message',
  },
  [DOMAIN_EVENTS.MESSAGE_READ]: {
    event: DOMAIN_EVENTS.MESSAGE_READ,
    type: 'CHAT',
    priority: 'LOW',
    channels: ['in_app'],
    recipients: ['explicit'],
    excludeActor: true,
    label: 'Message read',
  },
  [DOMAIN_EVENTS.USER_INVITED]: {
    event: DOMAIN_EVENTS.USER_INVITED,
    type: 'SYSTEM',
    priority: 'MEDIUM',
    channels: ['in_app', 'email'],
    recipients: ['explicit'],
    excludeActor: false,
    label: 'User invited',
  },
};

// ===========================================================================
// Default (system) templates. Used when no DB template exists for the event.
// Variables use {{var}} syntax resolved against the notification context.
// ===========================================================================

export interface SystemTemplate {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  emailSubject: string;
}

export const SYSTEM_TEMPLATES: Record<DomainEventKey, SystemTemplate> = {
  [DOMAIN_EVENTS.INQUIRY_CREATED]: {
    type: 'CRM',
    priority: 'MEDIUM',
    title: 'New inquiry: {{clientName}}',
    body: 'A new inquiry {{inquiryCode}} from {{clientName}} was created.',
    emailSubject: 'New inquiry {{inquiryCode}} — {{clientName}}',
  },
  [DOMAIN_EVENTS.LEAD_ASSIGNED]: {
    type: 'CRM',
    priority: 'HIGH',
    title: 'Lead assigned: {{clientName}}',
    body: 'You have been assigned inquiry {{inquiryCode}} ({{clientName}}).',
    emailSubject: 'You were assigned lead {{inquiryCode}}',
  },
  [DOMAIN_EVENTS.FOLLOWUP_DUE]: {
    type: 'CRM',
    priority: 'HIGH',
    title: 'Follow-up due: {{clientName}}',
    body: 'A {{followupType}} follow-up for {{clientName}} ({{inquiryCode}}) is due.',
    emailSubject: 'Follow-up due — {{clientName}}',
  },
  [DOMAIN_EVENTS.FOLLOWUP_MISSED]: {
    type: 'CRM',
    priority: 'CRITICAL',
    title: 'Follow-up missed: {{clientName}}',
    body: 'A follow-up for {{clientName}} ({{inquiryCode}}) was missed.',
    emailSubject: 'Missed follow-up — {{clientName}}',
  },
  [DOMAIN_EVENTS.SITE_VISIT_SCHEDULED]: {
    type: 'CRM',
    priority: 'MEDIUM',
    title: 'Site visit scheduled: {{clientName}}',
    body: 'A site visit for {{clientName}} ({{inquiryCode}}) is scheduled for {{scheduledAt}}.',
    emailSubject: 'Site visit scheduled — {{clientName}}',
  },
  [DOMAIN_EVENTS.SITE_VISIT_REMINDER]: {
    type: 'CRM',
    priority: 'HIGH',
    title: 'Site visit tomorrow: {{clientName}}',
    body: 'Reminder: site visit for {{clientName}} ({{inquiryCode}}) at {{scheduledAt}}.',
    emailSubject: 'Reminder: site visit — {{clientName}}',
  },
  [DOMAIN_EVENTS.PROPERTY_ASSIGNED]: {
    type: 'PROPERTY',
    priority: 'MEDIUM',
    title: 'Property assigned: {{propertyTitle}}',
    body: 'You have been assigned property {{propertyCode}} ({{propertyTitle}}).',
    emailSubject: 'Property assigned — {{propertyCode}}',
  },
  [DOMAIN_EVENTS.PROPERTY_STATUS_CHANGED]: {
    type: 'PROPERTY',
    priority: 'LOW',
    title: 'Property status changed: {{propertyTitle}}',
    body: 'Property {{propertyCode}} status changed from {{fromStatus}} to {{toStatus}}.',
    emailSubject: 'Property {{propertyCode}} status updated',
  },
  [DOMAIN_EVENTS.SUBSCRIPTION_EXPIRING]: {
    type: 'BILLING',
    priority: 'CRITICAL',
    title: 'Subscription expiring soon',
    body: 'Your subscription expires on {{expiresAt}}. Renew to avoid interruption.',
    emailSubject: 'Action needed: your subscription is expiring',
  },
  [DOMAIN_EVENTS.TRIAL_ENDING]: {
    type: 'BILLING',
    priority: 'HIGH',
    title: 'Trial ending soon',
    body: 'Your {{planName}} trial ends on {{expiresAt}}. Add payment to keep RE-OS active.',
    emailSubject: 'Your RE-OS trial is ending soon',
  },
  [DOMAIN_EVENTS.PAYMENT_FAILED]: {
    type: 'BILLING',
    priority: 'CRITICAL',
    title: 'Payment failed',
    body: 'We could not collect payment for {{planName}}. Please update billing to avoid suspension.',
    emailSubject: 'Payment failed for your RE-OS subscription',
  },
  [DOMAIN_EVENTS.INVOICE_GENERATED]: {
    type: 'BILLING',
    priority: 'MEDIUM',
    title: 'Invoice generated: {{invoiceNumber}}',
    body: 'Invoice {{invoiceNumber}} for {{planName}} is now available.',
    emailSubject: 'Invoice {{invoiceNumber}} is available',
  },
  [DOMAIN_EVENTS.SUBSCRIPTION_RENEWED]: {
    type: 'BILLING',
    priority: 'MEDIUM',
    title: 'Subscription renewed',
    body: 'Your {{planName}} subscription is renewed through {{expiresAt}}.',
    emailSubject: 'Your RE-OS subscription has renewed',
  },
  [DOMAIN_EVENTS.PLAN_CHANGED]: {
    type: 'BILLING',
    priority: 'MEDIUM',
    title: 'Plan changed to {{planName}}',
    body: 'Your subscription is now on {{planName}}.',
    emailSubject: 'Your RE-OS plan changed',
  },
  [DOMAIN_EVENTS.USER_INVITED]: {
    type: 'SYSTEM',
    priority: 'MEDIUM',
    title: 'You have been invited',
    body: 'You have been invited to join {{organizationName}} on RE-OS.',
    emailSubject: 'You are invited to {{organizationName}}',
  },
  [DOMAIN_EVENTS.CONVERSATION_CREATED]: {
    type: 'CHAT',
    priority: 'MEDIUM',
    title: 'New conversation: {{clientName}}',
    body: 'A new chat ({{conversationCode}}) from {{clientName}} has started.',
    emailSubject: 'New chat {{conversationCode}} — {{clientName}}',
  },
  [DOMAIN_EVENTS.CONVERSATION_ASSIGNED]: {
    type: 'CHAT',
    priority: 'HIGH',
    title: 'Chat assigned: {{clientName}}',
    body: 'You have been assigned chat {{conversationCode}} ({{clientName}}).',
    emailSubject: 'You were assigned chat {{conversationCode}}',
  },
  [DOMAIN_EVENTS.CONVERSATION_CLOSED]: {
    type: 'CHAT',
    priority: 'LOW',
    title: 'Chat closed: {{clientName}}',
    body: 'Chat {{conversationCode}} ({{clientName}}) was closed.',
    emailSubject: 'Chat {{conversationCode}} closed',
  },
  [DOMAIN_EVENTS.MESSAGE_RECEIVED]: {
    type: 'CHAT',
    priority: 'HIGH',
    title: 'New message from {{senderName}}',
    body: '{{preview}}',
    emailSubject: 'New message in chat {{conversationCode}}',
  },
  [DOMAIN_EVENTS.MESSAGE_READ]: {
    type: 'CHAT',
    priority: 'LOW',
    title: 'Message read',
    body: 'Your message in chat {{conversationCode}} was read.',
    emailSubject: 'Message read',
  },
};

// ===========================================================================
// Listing
// ===========================================================================

export const NOTIFICATION_SORTABLE_FIELDS = ['created_at'] as const;
export const NOTIFICATION_DEFAULT_PER_PAGE = 20;
export const NOTIFICATION_MAX_PER_PAGE = 100;

export type { DomainEventKey };
