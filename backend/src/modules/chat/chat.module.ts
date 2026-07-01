import { Module } from '@nestjs/common';

import { FeatureFlagsModule } from '../../common/feature-flags.module';
import { RecaptchaService } from '../../common/security/recaptcha.service';
import { AuditModule } from '../audit/audit.module';
import { CrmModule } from '../crm/crm.module';
import { StorageService } from '../properties/storage/storage.service';
import { SettingsModule } from '../settings/settings.module';
import { ChatAutoAssignService } from './chat-auto-assign.service';
import { ChatController, ChatMessagesController, PublicChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';

/**
 * Phase 6 — Live Chat & Omnichannel Foundation.
 *
 * Depends on CrmModule (inquiry conversion), AuditModule, and the shared
 * StorageService abstraction (S3 / local). Realtime delivery is via the
 * `/chat` Socket.io namespace (ChatGateway). Domain events feed the Phase 5
 * notification automation engine.
 */
@Module({
  imports: [AuditModule, CrmModule, FeatureFlagsModule, SettingsModule],
  controllers: [ChatController, ChatMessagesController, PublicChatController],
  providers: [ChatService, ChatRepository, ChatGateway, ChatAutoAssignService, RecaptchaService, StorageService],
  exports: [ChatService],
})
export class ChatModule {}
