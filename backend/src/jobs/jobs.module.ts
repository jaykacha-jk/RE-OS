import { Global, Module } from '@nestjs/common';

import { QueueService } from './queue.service';

/**
 * Global queue transport (BullMQ when Redis is configured, in-memory otherwise).
 */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class JobsModule {}
