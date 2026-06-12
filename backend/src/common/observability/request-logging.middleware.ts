import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Structured request logging + request-id propagation.
 *
 * - Assigns/propagates an `x-request-id` so logs, error responses, and error
 *   tracking can be correlated across a single request.
 * - Emits one log line per completed request. When `LOG_FORMAT=json` it writes
 *   newline-delimited JSON to stdout (ready for CloudWatch/Loki/Datadog log
 *   shippers); otherwise a human-readable line via the Nest logger.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('http');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const incomingId = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(incomingId) ? incomingId[0] : incomingId) || randomBytes(8).toString('hex');

    res.setHeader('x-request-id', requestId);
    (req as Request & { requestId?: string }).requestId = requestId;

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const tenant =
        (req as Request & { tenantId?: string | null }).tenantId ??
        (req.headers['x-tenant-id'] as string | undefined) ??
        null;

      const payload = {
        level: res.statusCode >= 500 ? 'error' : 'info',
        msg: 'request',
        method: req.method,
        url: req.originalUrl ?? req.url,
        status: res.statusCode,
        duration_ms: durationMs,
        request_id: requestId,
        tenant,
        ts: new Date().toISOString(),
      };

      if (process.env.LOG_FORMAT === 'json') {
        process.stdout.write(`${JSON.stringify(payload)}\n`);
      } else {
        const line = `${payload.method} ${payload.url} ${payload.status} ${payload.duration_ms}ms [${requestId}]`;
        if (payload.level === 'error') {
          this.logger.error(line);
        } else {
          this.logger.log(line);
        }
      }
    });

    next();
  }
}
