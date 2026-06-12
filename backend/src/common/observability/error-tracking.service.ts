import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export type ErrorContext = {
  requestId?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  method?: string | null;
  url?: string | null;
  statusCode?: number | null;
};

type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, hint?: unknown) => string;
  flush: (timeout?: number) => Promise<boolean>;
};

/**
 * Provider-agnostic error tracking sink.
 *
 * - When `SENTRY_DSN` is set, lazily loads `@sentry/node` (optional dependency,
 *   same require-on-demand pattern as the BullMQ queue driver) and forwards
 *   server-side faults to Sentry.
 * - Otherwise it is a safe no-op so local dev, CI, and tests run without the
 *   package or a network sink.
 *
 * Observability must never break the request path, so every method swallows
 * its own failures.
 */
@Injectable()
export class ErrorTrackingService implements OnModuleInit {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private sentry: SentryLike | null = null;
  private enabled = false;

  onModuleInit() {
    this.init();
  }

  init() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      this.logger.log('Error tracking disabled (no SENTRY_DSN configured).');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sentry = require('@sentry/node') as SentryLike;
      sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? 'development',
        release: process.env.APP_RELEASE,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
      });
      this.sentry = sentry;
      this.enabled = true;
      this.logger.log('Error tracking enabled (Sentry).');
    } catch (err) {
      this.enabled = false;
      this.logger.warn(
        `Sentry unavailable (${
          err instanceof Error ? err.message : String(err)
        }); error tracking disabled.`,
      );
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  captureException(error: unknown, context?: ErrorContext): void {
    if (!this.enabled || !this.sentry) return;
    try {
      const extra = context
        ? Object.fromEntries(
            Object.entries(context).filter(([, value]) => value !== undefined && value !== null),
          )
        : undefined;
      this.sentry.captureException(error, extra ? { extra } : undefined);
    } catch {
      // Never throw from the observability layer.
    }
  }

  async flush(timeoutMs = 2000): Promise<void> {
    if (!this.enabled || !this.sentry) return;
    try {
      await this.sentry.flush(timeoutMs);
    } catch {
      // Ignore flush failures during shutdown.
    }
  }
}
