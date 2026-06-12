/**
 * Canonical domain event keys (Phase 5).
 *
 * These strings are the single source of truth shared by:
 *  - emitters (CRM / Property / Platform services emit them via DomainEventBus),
 *  - the automation engine (maps an event -> recipients + notification spec),
 *  - notification templates (`notification_templates.key`),
 *  - user preferences (`notification_preferences.event_key`).
 *
 * Keeping them here (not in the notifications module) lets producer modules emit
 * events without importing the notifications module — preserving module
 * boundaries and the future event-bus extraction seam (SYSTEM_DESIGN.md).
 */
export const DOMAIN_EVENTS = {
  // CRM
  INQUIRY_CREATED: 'crm.inquiry.created',
  LEAD_ASSIGNED: 'crm.inquiry.assigned',
  FOLLOWUP_DUE: 'crm.followup.due',
  FOLLOWUP_MISSED: 'crm.followup.missed',
  SITE_VISIT_SCHEDULED: 'crm.sitevisit.scheduled',
  SITE_VISIT_REMINDER: 'crm.sitevisit.reminder',

  // Property
  PROPERTY_ASSIGNED: 'property.assigned',
  PROPERTY_STATUS_CHANGED: 'property.status_changed',

  // Chat (Phase 6 — Live Chat & Omnichannel foundation)
  CONVERSATION_CREATED: 'chat.conversation.created',
  CONVERSATION_ASSIGNED: 'chat.conversation.assigned',
  CONVERSATION_CLOSED: 'chat.conversation.closed',
  MESSAGE_RECEIVED: 'chat.message.received',
  MESSAGE_READ: 'chat.message.read',

  // Billing (foundation only — Phase 7 will emit)
  SUBSCRIPTION_EXPIRING: 'billing.subscription_expiring',
  TRIAL_ENDING: 'billing.trial_ending',
  PAYMENT_FAILED: 'billing.payment_failed',
  INVOICE_GENERATED: 'billing.invoice_generated',
  SUBSCRIPTION_RENEWED: 'billing.subscription_renewed',
  PLAN_CHANGED: 'billing.plan_changed',

  // System
  USER_INVITED: 'system.user_invited',
} as const;

export type DomainEventKey = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

/**
 * Base shape every domain event payload must carry. `tenantId` is nullable to
 * support platform-level (Super Admin) events. `actorUserId` is the user that
 * triggered the event (used to avoid self-notification where appropriate).
 */
export interface DomainEventPayload {
  tenantId: string | null;
  actorUserId?: string | null;
  /** Primary entity the event relates to (for deep links + dedupe). */
  entityType?: string;
  entityId?: string;
  /** Free-form context merged into template rendering + notification metadata. */
  context?: Record<string, unknown>;
  /**
   * Optional explicit recipients. When provided, the automation engine notifies
   * exactly these users instead of resolving recipients from the event type.
   */
  recipientUserIds?: string[];
  /** Optional delay (ms) before the notification is dispatched (reminders). */
  delayMs?: number;
}
