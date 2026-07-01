import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { QueueService } from '../../jobs/queue.service';
import { QUEUES, type QueueJob } from '../../jobs/queue.constants';
import { ChatService } from './chat.service';
import { CHAT_AUTO_ASSIGN_JOB, type ChatAutoAssignJobData } from './chat.types';

/**
 * Consumes delayed chat automation jobs (BR-CH02 auto-assign).
 */
@Injectable()
export class ChatAutoAssignService implements OnModuleInit {
  private readonly logger = new Logger(ChatAutoAssignService.name);

  constructor(
    private readonly queue: QueueService,
    private readonly chat: ChatService,
  ) {}

  onModuleInit() {
    this.queue.register<ChatAutoAssignJobData>(QUEUES.CHAT, (job) => this.handle(job));
  }

  async handle(job: QueueJob<ChatAutoAssignJobData>): Promise<void> {
    if (job.name !== CHAT_AUTO_ASSIGN_JOB) return;
    try {
      await this.chat.performAutoAssign(job.data.tenantId, job.data.conversationId);
    } catch (err) {
      this.logger.error(
        `Auto-assign failed conversation=${job.data.conversationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err;
    }
  }
}
