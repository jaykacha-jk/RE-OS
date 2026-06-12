import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = randomBytes(16).toString('hex');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: { field?: string; message: string }[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        message = (obj.message as string) ?? message;
        if (Array.isArray(obj.message)) {
          message = 'Validation failed';
          details = obj.message.map((m) => ({
            message: typeof m === 'string' ? m : JSON.stringify(m),
          }));
        }
        if (obj.code && typeof obj.code === 'string') {
          code = obj.code;
        }
        if (obj.error && typeof obj.error === 'string') {
          code = obj.error;
        }
      }

      code = this.mapStatusToCode(status, code, exception);
    }

    // Observability: log server-side faults (5xx) with full stack + request
    // context so 500s never disappear silently. Client errors (4xx) are
    // expected control flow and logged at debug level only.
    const method = request?.method ?? '?';
    const url = request?.originalUrl ?? request?.url ?? '?';
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `${method} ${url} -> ${status} [${requestId}] ${message}`,
        stack,
      );
    } else {
      this.logger.debug(`${method} ${url} -> ${status} [${requestId}] ${message}`);
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        request_id: requestId,
      },
    });
  }

  private mapStatusToCode(status: number, existing: string, exception: HttpException) {
    if (existing !== 'INTERNAL_ERROR' && existing !== exception.name) {
      return existing;
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'BUSINESS_RULE_VIOLATION';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
