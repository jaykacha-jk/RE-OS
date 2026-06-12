import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CrmModule } from '../crm/crm.module';
import { StorageService } from '../properties/storage/storage.service';
import { ChatController, ChatMessagesController } from './chat.controller';
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
  imports: [AuditModule, CrmModule],
  controllers: [ChatController, ChatMessagesController],
  providers: [ChatService, ChatRepository, ChatGateway, StorageService],
  exports: [ChatService],
})
export class ChatModule {}
