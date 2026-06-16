import { Module } from '@nestjs/common';

import { FeatureFlagsModule } from '../../common/feature-flags.module';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../../providers/email/email.module';
import { AutomationService } from './automation.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplatesController } from './notification-templates.controller';
import { NotificationTemplatesService } from './notification-templates.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { TemplateRenderer } from './template-renderer';

/**
 * Phase 5 — Notifications & Automation Engine.
 *
 * Depends on the global EventsModule (DomainEventBus), JobsModule (QueueService)
 * and EmailModule (provider). Producer modules (CRM/Property/Platform) stay
 * decoupled — they emit domain events; this module reacts to them.
 */
@Module({
  imports: [AuditModule, EmailModule, FeatureFlagsModule],
  controllers: [
    NotificationsController,
    NotificationPreferencesController,
    NotificationTemplatesController,
  ],
  providers: [
    NotificationsRepository,
    NotificationsService,
    NotificationPreferencesService,
    NotificationTemplatesService,
    TemplateRenderer,
    NotificationsGateway,
    NotificationDispatcherService,
    AutomationService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
