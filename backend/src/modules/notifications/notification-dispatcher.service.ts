import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { QueueService } from '../../jobs/queue.service';
import { QUEUES, type QueueJob } from '../../jobs/queue.constants';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from '../../providers/email/email-provider.interface';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './notifications.repository';
import { NotificationPreferencesService } from './notification-preferences.service';
import { TemplateRenderer } from './template-renderer';
import {
  DISPATCH_JOB,
  EMAIL_JOB,
  REMINDER_JOB,
  type DispatchJobData,
  type EmailJobData,
} from './notifications.types';

/**
 * Consumes queued jobs and performs the actual delivery work — the only place
 * notifications are persisted/sent. Nothing here runs in an HTTP request path;
 * all entry points are queue handlers.
 *
 * Flow:
 *   dispatch job -> check prefs -> (in_app) persist + realtime
 *                                -> (email) enqueue email job
 *   email job    -> render + provider.send + delivery log
 */
@Injectable()
export class NotificationDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly renderer: TemplateRenderer,
    private readonly preferences: NotificationPreferencesService,
    private readonly gateway: NotificationsGateway,
    private readonly queue: QueueService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  onModuleInit() {
    this.queue.register<DispatchJobData>(QUEUES.NOTIFICATIONS, (job) =>
      this.handleDispatch(job),
    );
    this.queue.register<DispatchJobData>(QUEUES.REMINDERS, (job) =>
      this.handleDispatch(job),
    );
    this.queue.register<EmailJobData>(QUEUES.EMAIL, (job) => this.handleEmail(job));
  }

  // ===========================================================================
  // dispatch + reminder jobs
  // ===========================================================================

  async handleDispatch(job: QueueJob<DispatchJobData>): Promise<void> {
    if (job.name !== DISPATCH_JOB && job.name !== REMINDER_JOB) return;
    const data = job.data;
    const pref = await this.preferences.resolve(data.userId, data.eventKey);

    const wantInApp = data.channels.includes('in_app') && pref.inApp;
    const wantEmail = data.channels.includes('email') && pref.email;

    if (wantInApp) {
      await this.deliverInApp(data);
    }
    if (wantEmail) {
      await this.queue.enqueue<EmailJobData>(QUEUES.EMAIL, EMAIL_JOB, {
        tenantId: data.tenantId,
        userId: data.userId,
        eventKey: data.eventKey,
        context: data.context,
        subject: data.title,
        body: data.message,
      });
    }
  }

  private async deliverInApp(data: DispatchJobData): Promise<void> {
    const dbTemplate = await this.repo
      .findActiveTemplate(data.tenantId, data.eventKey, 'in_app')
      .catch(() => null);

    const rendered = this.renderer.render({
      key: data.eventKey,
      channel: 'in_app',
      context: data.context,
      dbTemplate: dbTemplate
        ? {
            title_template: dbTemplate.title_template,
            body_template: dbTemplate.body_template,
            email_subject_template: dbTemplate.email_subject_template,
            type: dbTemplate.type,
            priority: dbTemplate.priority,
          }
        : null,
      fallback: {
        type: data.type,
        priority: data.priority,
        title: data.title ?? 'Notification',
        body: data.message ?? '',
      },
    });

    const notification = await this.repo.createNotification({
      tenant_id: data.tenantId,
      user_id: data.userId,
      title: rendered.title,
      message: rendered.body,
      type: rendered.type,
      priority: rendered.priority,
      channel: 'in_app',
      event_key: data.eventKey,
      action_url: data.actionUrl ?? null,
      entity_type: data.entityType ?? null,
      entity_id: data.entityId ?? null,
      metadata: (data.context ?? {}) as Prisma.InputJsonValue,
    });

    await this.repo
      .createDeliveryLog({
        tenantId: data.tenantId,
        notificationId: notification.id,
        userId: data.userId,
        channel: 'in_app',
        status: 'sent',
        provider: 'in_app',
        sentAt: new Date(),
      })
      .catch(() => undefined);

    // Realtime: push the new notification + refreshed unread count.
    this.gateway.emitNotification(data.userId, this.serialize(notification));
    const unread = await this.repo
      .countUnread(data.userId, data.tenantId)
      .catch(() => null);
    if (unread !== null) this.gateway.emitUnreadCount(data.userId, unread);
  }

  // ===========================================================================
  // email jobs
  // ===========================================================================

  async handleEmail(job: QueueJob<EmailJobData>): Promise<void> {
    if (job.name !== EMAIL_JOB) return;
    const data = job.data;

    const contact = await this.repo.findUserContact(data.userId).catch(() => null);
    if (!contact?.email) {
      await this.logEmail(data, 'skipped', null, 'no email address');
      return;
    }

    const dbTemplate = await this.repo
      .findActiveTemplate(data.tenantId, data.eventKey, 'email')
      .catch(() => null);

    const rendered = this.renderer.render({
      key: data.eventKey,
      channel: 'email',
      context: data.context,
      dbTemplate: dbTemplate
        ? {
            title_template: dbTemplate.title_template,
            body_template: dbTemplate.body_template,
            email_subject_template: dbTemplate.email_subject_template,
            type: dbTemplate.type,
            priority: dbTemplate.priority,
          }
        : null,
      fallback: {
        type: 'SYSTEM',
        priority: 'MEDIUM',
        title: data.subject ?? 'Notification',
        body: data.body ?? '',
      },
    });

    try {
      const result = await this.email.send({
        to: contact.email,
        subject: rendered.emailSubject,
        text: rendered.body,
        html: data.html ?? this.textToHtml(rendered.body),
        tenantId: data.tenantId,
      });
      await this.logEmail(
        data,
        result.accepted ? 'sent' : 'failed',
        result.provider,
        result.accepted ? null : 'provider rejected',
      );
    } catch (err) {
      await this.logEmail(
        data,
        'failed',
        this.email.name,
        err instanceof Error ? err.message : String(err),
      );
      throw err; // let the queue retry
    }
  }

  private async logEmail(
    data: EmailJobData,
    status: string,
    provider: string | null,
    error: string | null,
  ) {
    await this.repo
      .createDeliveryLog({
        tenantId: data.tenantId,
        notificationId: data.notificationId ?? null,
        userId: data.userId,
        channel: 'email',
        status,
        provider,
        error,
        sentAt: status === 'sent' ? new Date() : null,
      })
      .catch(() => undefined);
  }

  private serialize(n: {
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
  }) {
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

  private textToHtml(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    return escaped
      .split(/\r?\n/)
      .map((line) => `<p>${line || '&nbsp;'}</p>`)
      .join('');
  }
}
