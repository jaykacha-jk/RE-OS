import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue, Worker } from 'bullmq';

import {
  ALL_QUEUES,
  type JobHandler,
  type JobOptions,
  type QueueName,
} from './queue.constants';

/**
 * Queue transport abstraction.
 *
 * - In production, Redis-backed **BullMQ** is required for durable,
 *   distributed, retryable job processing.
 * - Outside production, falls back to an in-process async queue (timers) when
 *   Redis is not configured so local dev, CI and tests run without Redis. Either
 *   way work is asynchronous — nothing is processed synchronously in the
 *   request path ("everything queued").
 *
 * This mirrors the codebase's existing "abstraction + local fallback" pattern
 * (S3/local storage, in-memory analytics cache) and keeps a single seam to
 * swap drivers without touching producers/consumers.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private driver: 'bullmq' | 'memory' = 'memory';

  private readonly handlers = new Map<QueueName, JobHandler>();
  private readonly bullQueues = new Map<QueueName, Queue>();
  private readonly bullWorkers = new Map<QueueName, Worker>();
  private readonly timers = new Set<NodeJS.Timeout>();

  // Resolved lazily so the app boots without bullmq/redis present.
  private bull: typeof import('bullmq') | null = null;
  private connection: { host: string; port: number; password?: string } | null =
    null;

  onModuleInit() {
    const redisConfigured = Boolean(
      process.env.REDIS_URL || process.env.REDIS_HOST,
    );
    if (!redisConfigured) {
      if (this.isProduction) {
        throw new Error(
          'REDIS_URL or REDIS_HOST is required in production for QueueService',
        );
      }
      this.driver = 'memory';
      this.logger.log('QueueService using in-memory driver (no Redis configured).');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.bull = require('bullmq') as typeof import('bullmq');
      this.connection = this.resolveConnection();
      this.driver = 'bullmq';
      this.logger.log('QueueService using BullMQ driver (Redis configured).');
    } catch (err) {
      if (this.isProduction) {
        throw new Error(
          `BullMQ queue initialization failed in production: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      this.driver = 'memory';
      this.logger.warn(
        `BullMQ unavailable (${
          err instanceof Error ? err.message : String(err)
        }); falling back to in-memory queue.`,
      );
    }
  }

  get activeDriver(): 'bullmq' | 'memory' {
    return this.driver;
  }

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private resolveConnection() {
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL);
      return {
        host: url.hostname,
        port: url.port ? Number(url.port) : 6379,
        ...(url.password ? { password: url.password } : {}),
      };
    }
    return {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      ...(process.env.REDIS_PASSWORD
        ? { password: process.env.REDIS_PASSWORD }
        : {}),
    };
  }

  /**
   * Register the processor for a queue. Idempotent per queue. For BullMQ this
   * spins up a Worker; for memory mode it just records the handler.
   */
  register<T = unknown>(queue: QueueName, handler: JobHandler<T>): void {
    this.handlers.set(queue, handler as JobHandler);

    if (this.driver === 'bullmq' && this.bull && this.connection) {
      if (this.bullWorkers.has(queue)) return;
      const worker = new this.bull.Worker(
        queue,
        async (job) => {
          await handler({ name: job.name, data: job.data as T });
        },
        { connection: this.connection },
      );
      worker.on('failed', (job, err) => {
        this.logger.error(
          `Job failed queue=${queue} name=${job?.name} error=${err?.message}`,
        );
      });
      this.bullWorkers.set(queue, worker);
    }
  }

  /**
   * Enqueue a job. Never throws into the caller — queue failures must not break
   * the originating business operation.
   */
  async enqueue<T = unknown>(
    queue: QueueName,
    name: string,
    data: T,
    opts: JobOptions = {},
  ): Promise<void> {
    try {
      if (this.driver === 'bullmq' && this.bull && this.connection) {
        const q = this.getBullQueue(queue);
        await q.add(name, data, {
          delay: opts.delayMs,
          attempts: opts.attempts ?? 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        });
        return;
      }
      this.enqueueMemory(queue, name, data, opts);
    } catch (err) {
      this.logger.error(
        `Failed to enqueue queue=${queue} name=${name}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private getBullQueue(queue: QueueName): Queue {
    let q = this.bullQueues.get(queue);
    if (!q && this.bull && this.connection) {
      q = new this.bull.Queue(queue, { connection: this.connection });
      this.bullQueues.set(queue, q);
    }
    return q as Queue;
  }

  private enqueueMemory<T>(
    queue: QueueName,
    name: string,
    data: T,
    opts: JobOptions,
  ): void {
    const run = () => {
      const handler = this.handlers.get(queue);
      if (!handler) {
        this.logger.warn(`No handler registered for queue=${queue}; job dropped.`);
        return;
      }
      Promise.resolve()
        .then(() => handler({ name, data }))
        .catch((err) =>
          this.logger.error(
            `In-memory job failed queue=${queue} name=${name}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
    };

    if (opts.delayMs && opts.delayMs > 0) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        run();
      }, opts.delayMs);
      // Don't keep the event loop alive solely for a pending reminder.
      if (typeof timer.unref === 'function') timer.unref();
      this.timers.add(timer);
    } else {
      setImmediate(run);
    }
  }

  async onModuleDestroy() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    await Promise.all(
      [...this.bullWorkers.values()].map((w) => w.close().catch(() => undefined)),
    );
    await Promise.all(
      [...this.bullQueues.values()].map((q) => q.close().catch(() => undefined)),
    );
  }
}

// Keep ALL_QUEUES referenced for consumers/tooling that import barrel symbols.
export { ALL_QUEUES };
