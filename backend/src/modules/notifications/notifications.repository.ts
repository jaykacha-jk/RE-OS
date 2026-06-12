import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import { ORG_ADMIN_ROLES } from './notifications.constants';

export interface ListNotificationsFilters {
  type?: string;
  isRead?: boolean;
  page: number;
  perPage: number;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.dbClient;
  }

  // ===========================================================================
  // Notifications
  // ===========================================================================

  async createNotification(data: Prisma.notificationsUncheckedCreateInput) {
    return this.db.notifications.create({ data });
  }

  /**
   * Tenant + user scoped list. Users only ever see their own notifications;
   * tenant_id is matched too (null for platform Super Admin) for defence in
   * depth against cross-tenant leakage.
   */
  async listForUser(
    userId: string,
    tenantId: string | null,
    filters: ListNotificationsFilters,
  ) {
    const where: Prisma.notificationsWhereInput = {
      user_id: userId,
      tenant_id: tenantId,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.isRead !== undefined ? { is_read: filters.isRead } : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.notifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      this.db.notifications.count({ where }),
    ]);
    return { rows, total };
  }

  async countUnread(userId: string, tenantId: string | null) {
    return this.db.notifications.count({
      where: { user_id: userId, tenant_id: tenantId, is_read: false },
    });
  }

  async findByIdForUser(id: string, userId: string, tenantId: string | null) {
    return this.db.notifications.findFirst({
      where: { id, user_id: userId, tenant_id: tenantId },
    });
  }

  async markRead(id: string, userId: string, tenantId: string | null) {
    const result = await this.db.notifications.updateMany({
      where: { id, user_id: userId, tenant_id: tenantId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
    return result.count;
  }

  async markAllRead(userId: string, tenantId: string | null) {
    const result = await this.db.notifications.updateMany({
      where: { user_id: userId, tenant_id: tenantId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
    return result.count;
  }

  // ===========================================================================
  // Preferences
  // ===========================================================================

  async listPreferences(userId: string) {
    return this.db.notification_preferences.findMany({
      where: { user_id: userId },
      orderBy: { event_key: 'asc' },
    });
  }

  async findPreference(userId: string, eventKey: string) {
    return this.db.notification_preferences.findUnique({
      where: { user_id_event_key: { user_id: userId, event_key: eventKey } },
    });
  }

  async upsertPreference(input: {
    userId: string;
    tenantId: string | null;
    eventKey: string;
    inApp: boolean;
    email: boolean;
  }) {
    return this.db.notification_preferences.upsert({
      where: {
        user_id_event_key: { user_id: input.userId, event_key: input.eventKey },
      },
      update: { in_app: input.inApp, email: input.email },
      create: {
        user_id: input.userId,
        tenant_id: input.tenantId,
        event_key: input.eventKey,
        in_app: input.inApp,
        email: input.email,
      },
    });
  }

  // ===========================================================================
  // Templates
  // ===========================================================================

  /** Tenant-specific template, falling back to a system (tenant_id null) one. */
  async findActiveTemplate(
    tenantId: string | null,
    key: string,
    channel: string,
  ) {
    if (tenantId) {
      const tenantTemplate = await this.db.notification_templates.findFirst({
        where: { tenant_id: tenantId, key, channel, is_active: true, deleted_at: null },
      });
      if (tenantTemplate) return tenantTemplate;
    }
    return this.db.notification_templates.findFirst({
      where: { tenant_id: null, key, channel, is_active: true, deleted_at: null },
    });
  }

  async listTemplates(tenantId: string | null, includeSystem: boolean) {
    return this.db.notification_templates.findMany({
      where: {
        deleted_at: null,
        OR: [
          { tenant_id: tenantId },
          ...(includeSystem ? [{ tenant_id: null }] : []),
        ],
      },
      orderBy: [{ key: 'asc' }, { channel: 'asc' }],
    });
  }

  async findTemplateById(id: string, tenantId: string | null) {
    return this.db.notification_templates.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
    });
  }

  async createTemplate(data: Prisma.notification_templatesCreateInput) {
    return this.db.notification_templates.create({ data });
  }

  async updateTemplate(id: string, data: Prisma.notification_templatesUpdateInput) {
    return this.db.notification_templates.update({ where: { id }, data });
  }

  // ===========================================================================
  // Delivery logs
  // ===========================================================================

  async createDeliveryLog(input: {
    tenantId: string | null;
    notificationId: string | null;
    userId: string;
    channel: string;
    status: string;
    provider?: string | null;
    error?: string | null;
    attempts?: number;
    sentAt?: Date | null;
  }) {
    return this.db.notification_delivery_logs.create({
      data: {
        tenant_id: input.tenantId,
        notification_id: input.notificationId,
        user_id: input.userId,
        channel: input.channel,
        status: input.status,
        provider: input.provider ?? null,
        error: input.error ?? null,
        attempts: input.attempts ?? 0,
        sent_at: input.sentAt ?? null,
      },
    });
  }

  // ===========================================================================
  // Durable queue outbox (audit + at-least-once safety net)
  // ===========================================================================

  async createQueueEntry(input: {
    tenantId: string | null;
    queue: string;
    jobType: string;
    payload: Prisma.InputJsonValue;
    availableAt?: Date;
  }) {
    return this.db.notification_queue.create({
      data: {
        tenant_id: input.tenantId,
        queue: input.queue,
        job_type: input.jobType,
        payload: input.payload,
        available_at: input.availableAt ?? new Date(),
      },
    });
  }

  async markQueueEntry(
    id: string,
    status: 'processing' | 'completed' | 'failed',
    error?: string | null,
  ) {
    return this.db.notification_queue.update({
      where: { id },
      data: {
        status,
        ...(status === 'processing' ? { locked_at: new Date() } : {}),
        ...(status === 'completed' ? { processed_at: new Date() } : {}),
        ...(status === 'failed'
          ? { last_error: error ?? null, attempts: { increment: 1 } }
          : {}),
      },
    });
  }

  // ===========================================================================
  // Recipient resolution (automation engine)
  // ===========================================================================

  async findEmployeeUserId(employeeId: string): Promise<string | null> {
    const employee = await this.db.employees.findFirst({
      where: { id: employeeId, deleted_at: null },
      select: { user_id: true },
    });
    return employee?.user_id ?? null;
  }

  async findManagerUserId(employeeId: string): Promise<string | null> {
    const employee = await this.db.employees.findFirst({
      where: { id: employeeId, deleted_at: null },
      select: { manager: { select: { user_id: true } } },
    });
    return employee?.manager?.user_id ?? null;
  }

  async findOrgAdminUserIds(tenantId: string): Promise<string[]> {
    const rows = await this.db.user_roles.findMany({
      where: {
        tenant_id: tenantId,
        role: { code: { in: ORG_ADMIN_ROLES } },
      },
      select: { user_id: true },
    });
    return [...new Set(rows.map((r) => r.user_id))];
  }

  async findUserContact(userId: string) {
    return this.db.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tenant_id: true, status: true },
    });
  }
}
