import type {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from './notifications.constants';

/** Payload for a 'dispatch' job (NOTIFICATIONS / REMINDERS queues). */
export interface DispatchJobData {
  tenantId: string | null;
  userId: string;
  eventKey: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  context: Record<string, unknown>;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  /** For ad-hoc notifications with no template. */
  title?: string;
  message?: string;
}

/** Payload for an 'email' job (EMAIL queue). */
export interface EmailJobData {
  tenantId: string | null;
  userId: string;
  eventKey: string;
  context: Record<string, unknown>;
  notificationId?: string | null;
  /** Pre-rendered fallbacks if no template resolves. */
  subject?: string;
  body?: string;
  html?: string;
}

export const DISPATCH_JOB = 'dispatch';
export const EMAIL_JOB = 'email';
export const REMINDER_JOB = 'reminder';
