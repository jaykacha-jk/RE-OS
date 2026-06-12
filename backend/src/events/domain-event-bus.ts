import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';

import type { DomainEventKey, DomainEventPayload } from './domain-events';

export type DomainEventHandler = (
  payload: DomainEventPayload,
) => void | Promise<void>;

/**
 * Lightweight, dependency-free in-process domain event bus.
 *
 * Producer modules (CRM, Property, Platform) emit events; the automation engine
 * subscribes. This decouples modules (no direct cross-module service imports for
 * side effects) and is the seam we will swap for a durable event bus / outbox
 * when extracting microservices (SYSTEM_DESIGN.md).
 *
 * Handlers are invoked asynchronously and their failures are isolated so a
 * notification failure can never break the originating business transaction.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    // Domain events can legitimately have many listeners over time.
    this.emitter.setMaxListeners(100);
  }

  on(event: DomainEventKey, handler: DomainEventHandler): void {
    this.emitter.on(event, (payload: DomainEventPayload) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => {
          this.logger.error(
            `Domain event handler for "${event}" failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    });
  }

  /**
   * Emit a domain event. Fire-and-forget by design: never throws into the
   * caller's request path.
   */
  emit(event: DomainEventKey, payload: DomainEventPayload): void {
    try {
      this.emitter.emit(event, payload);
    } catch (err) {
      this.logger.error(
        `Failed to emit domain event "${event}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
