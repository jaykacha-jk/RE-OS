import { Injectable, Logger } from '@nestjs/common';

import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from './email-provider.interface';

/**
 * Production email provider INTERFACE/skeleton.
 *
 * Intentionally NOT wired to a real ESP yet (no AWS SES / SendGrid / SMTP
 * integration in this phase, per scope). It is selected only when
 * EMAIL_PROVIDER=production. The `send()` method is the single integration
 * point a later phase implements (credentials must come from a secrets
 * manager — never committed; see docs/SECURITY.md).
 *
 * Until implemented it fails fast so misconfiguration is obvious rather than
 * silently dropping mail. The dispatcher records the failure in the delivery
 * log and retries via the queue.
 */
@Injectable()
export class ProductionEmailProvider implements EmailProvider {
  readonly name = 'production';
  private readonly logger = new Logger('ProductionEmailProvider');

  async send(_message: EmailMessage): Promise<EmailSendResult> {
    this.logger.warn(
      'ProductionEmailProvider.send called but no ESP integration is configured.',
    );
    // TODO(Phase 7+): integrate AWS SES / SendGrid here.
    //   const client = new SESv2Client({ region: process.env.AWS_REGION });
    //   ...map message -> SendEmailCommand, return real messageId.
    throw new Error(
      'EMAIL_PROVIDER=production is not yet integrated. Configure an ESP or use the dev provider.',
    );
  }
}
