import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthUser } from '../../common/context/auth-user';
import { QueueService } from '../../jobs/queue.service';
import { QUEUES } from '../../jobs/queue.constants';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './notifications.repository';
import {
  NOTIFICATION_DEFAULT_PER_PAGE,
  NOTIFICATION_MAX_PER_PAGE,
  type NotificationChannel,
  type NotificationPriority,
  type NotificationType,
} from './notifications.constants';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  DISPATCH_JOB,
  REMINDER_JOB,
  type DispatchJobData,
} from './notifications.types';

export interface DispatchInput {
  tenantId: string | null;
  userId: string;
  eventKey: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  context?: Record<string, unknown>;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  title?: string;
  message?: string;
  /** Delay before dispatch (reminders). Routes to the reminders queue. */
  delayMs?: number;
}

type NotificationRow = {
  id: string;
  tenant_id: string | null;
  title: string;
  message: string;
  type: string;
  priority: string;
  channel: string;
  event_key: string | null;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly queue: QueueService,
    private readonly gateway: NotificationsGateway,
  ) {}

  // ===========================================================================
  // Dispatch (public API for automation engine + other modules)
  // Always asynchronous: enqueues a job; never sends synchronously.
  // ===========================================================================

  async dispatch(input: DispatchInput): Promise<void> {
    const data: DispatchJobData = {
      tenantId: input.tenantId,
      userId: input.userId,
      eventKey: input.eventKey,
      type: input.type,
      priority: input.priority,
      channels: input.channels,
      context: input.context ?? {},
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      actionUrl: input.actionUrl ?? null,
      title: input.title,
      message: input.message,
    };

    const isReminder = Boolean(input.delayMs && input.delayMs > 0);
    const queueName = isReminder ? QUEUES.REMINDERS : QUEUES.NOTIFICATIONS;
    const jobName = isReminder ? REMINDER_JOB : DISPATCH_JOB;

    // Durable outbox record (best-effort; audit + at-least-once safety net).
    await this.repo
      .createQueueEntry({
        tenantId: input.tenantId,
        queue: queueName,
        jobType: jobName,
        payload: data as unknown as Prisma.InputJsonValue,
        availableAt: isReminder ? new Date(Date.now() + input.delayMs!) : new Date(),
      })
      .catch((err) =>
        this.logger.warn(
          `Outbox write failed (continuing): ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );

    await this.queue.enqueue(queueName, jobName, data, {
      delayMs: input.delayMs,
    });
  }

  // ===========================================================================
  // Query API (RBAC: a user only ever sees their own notifications)
  // ===========================================================================

  async list(user: AuthUser, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const perPage = Math.min(
      query.per_page ?? NOTIFICATION_DEFAULT_PER_PAGE,
      NOTIFICATION_MAX_PER_PAGE,
    );

    const { rows, total } = await this.repo.listForUser(user.userId, user.tenantId, {
      type: query['filter[type]'],
      isRead:
        query['filter[is_read]'] === undefined
          ? undefined
          : query['filter[is_read]'] === 'true',
      page,
      perPage,
    });

    return {
      data: rows.map((r) => this.map(r as NotificationRow)),
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) || 1 },
    };
  }

  async unreadCount(user: AuthUser) {
    const count = await this.repo.countUnread(user.userId, user.tenantId);
    return { unread_count: count };
  }

  async markRead(user: AuthUser, id: string) {
    const existing = await this.repo.findByIdForUser(id, user.userId, user.tenantId);
    if (!existing) throw new NotFoundException('Notification not found');

    if (!existing.is_read) {
      await this.repo.markRead(id, user.userId, user.tenantId);
    }
    const unread = await this.repo.countUnread(user.userId, user.tenantId);
    this.gateway.emitRead(user.userId, { id, unread_count: unread });

    return { id, is_read: true, unread_count: unread };
  }

  async markAllRead(user: AuthUser) {
    const updated = await this.repo.markAllRead(user.userId, user.tenantId);
    this.gateway.emitRead(user.userId, { all: true, unread_count: 0 });
    return { updated, unread_count: 0 };
  }

  // ===========================================================================
  // Mapper
  // ===========================================================================

  private map(n: NotificationRow) {
    return {
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      priority: n.priority,
      channel: n.channel,
      event_key: n.event_key,
      action_url: n.action_url,
      entity_type: n.entity_type,
      entity_id: n.entity_id,
      metadata: n.metadata,
      is_read: n.is_read,
      read_at: n.read_at?.toISOString() ?? null,
      created_at: n.created_at.toISOString(),
    };
  }
}
