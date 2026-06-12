import { Global, Module } from '@nestjs/common';

import { DomainEventBus } from './domain-event-bus';

/**
 * Global so any producer module can inject `DomainEventBus` to emit events
 * without importing the notifications module (keeps module boundaries clean).
 */
@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class EventsModule {}
