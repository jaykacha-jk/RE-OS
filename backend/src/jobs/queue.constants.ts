export const QUEUES = {
  /** In-app notification dispatch (render + persist + realtime). */
  NOTIFICATIONS: 'notifications',
  /** Email delivery jobs. */
  EMAIL: 'email',
  /** Delayed reminders (follow-up due, site-visit tomorrow, etc). */
  REMINDERS: 'reminders',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const ALL_QUEUES: QueueName[] = [
  QUEUES.NOTIFICATIONS,
  QUEUES.EMAIL,
  QUEUES.REMINDERS,
];

export interface JobOptions {
  /** Delay before processing (ms). Used for reminders. */
  delayMs?: number;
  /** Max attempts (queue driver dependent). */
  attempts?: number;
}

export interface QueueJob<T = unknown> {
  name: string;
  data: T;
}

export type JobHandler<T = unknown> = (
  job: QueueJob<T>,
) => Promise<void> | void;
