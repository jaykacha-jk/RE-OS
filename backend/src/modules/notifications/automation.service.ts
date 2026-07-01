import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../../events/domain-event-bus';
import {
  type DomainEventKey,
  type DomainEventPayload,
} from '../../events/domain-events';
import {
  AUTOMATION_RULES,
  type AutomationRule,
} from './notifications.constants';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

/**
 * Automation engine: the operational heartbeat.
 *
 * Subscribes to every configured domain event and turns it into one queued
 * notification per resolved recipient. Recipient resolution (assigned employee,
 * manager, org admins, actor, explicit) is data-driven from AUTOMATION_RULES so
 * rules are configurable in one place. No notification is sent synchronously —
 * each recipient gets an enqueued dispatch job.
 */
@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly bus: DomainEventBus,
    private readonly repo: NotificationsRepository,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    for (const key of Object.keys(AUTOMATION_RULES) as DomainEventKey[]) {
      this.bus.on(key, (payload) => this.handle(key, payload));
    }
    this.logger.log(
      `Automation engine subscribed to ${Object.keys(AUTOMATION_RULES).length} events.`,
    );
  }

  /** Public for unit testing (bypasses the event bus). */
  async handle(eventKey: DomainEventKey, payload: DomainEventPayload): Promise<void> {
    const rule = AUTOMATION_RULES[eventKey];
    if (!rule) return;

    const recipients = await this.resolveRecipients(rule, payload);
    if (recipients.length === 0) return;

    const actionUrl = this.buildActionUrl(payload.entityType, payload.entityId);

    await Promise.all(
      recipients.map((userId) =>
        this.notifications.dispatch({
          tenantId: payload.tenantId,
          userId,
          eventKey,
          type: rule.type,
          priority: rule.priority,
          channels: rule.channels,
          context: payload.context ?? {},
          entityType: payload.entityType ?? null,
          entityId: payload.entityId ?? null,
          actionUrl,
          delayMs: payload.delayMs,
        }),
      ),
    );
  }

  private async resolveRecipients(
    rule: AutomationRule,
    payload: DomainEventPayload,
  ): Promise<string[]> {
    const set = new Set<string>();

    for (const strategy of rule.recipients) {
      switch (strategy) {
        case 'explicit':
          (payload.recipientUserIds ?? []).forEach((id) => id && set.add(id));
          break;
        case 'actor':
          if (payload.actorUserId) set.add(payload.actorUserId);
          break;
        case 'assigned_employee': {
          const employeeId = this.employeeId(payload);
          if (employeeId) {
            const userId = await this.repo.findEmployeeUserId(employeeId);
            if (userId) set.add(userId);
          }
          break;
        }
        case 'manager': {
          const employeeId = this.employeeId(payload);
          if (employeeId) {
            const userId = await this.repo.findManagerUserId(employeeId);
            if (userId) set.add(userId);
          }
          break;
        }
        case 'org_admins': {
          if (payload.tenantId) {
            const ids = await this.repo.findOrgAdminUserIds(payload.tenantId);
            ids.forEach((id) => set.add(id));
          }
          break;
        }
      }
    }

    if (rule.excludeActor && payload.actorUserId) {
      set.delete(payload.actorUserId);
    }
    return [...set];
  }

  private employeeId(payload: DomainEventPayload): string | null {
    const value = payload.context?.['employeeId'];
    return typeof value === 'string' ? value : null;
  }

  private buildActionUrl(
    entityType?: string,
    entityId?: string,
  ): string | null {
    if (!entityType || !entityId) return null;
    switch (entityType) {
      case 'inquiry':
        return `/inquiries/${entityId}`;
      case 'property':
        return `/properties/${entityId}`;
      case 'conversation':
        return `/chat?conversation=${entityId}`;
      default:
        return null;
    }
  }
}
