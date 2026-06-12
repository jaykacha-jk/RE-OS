import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from './email-provider.interface';

/**
 * Development email provider.
 *
 * Does not send real email — it logs the rendered message and returns a
 * synthetic message id. Used in local/dev/test so the full notification
 * pipeline (queue -> render -> deliver -> log) can be exercised end-to-end
 * without an external provider. Selected when EMAIL_PROVIDER !== 'production'.
 */
@Injectable()
export class DevEmailProvider implements EmailProvider {
  readonly name = 'dev';
  private readonly logger = new Logger('DevEmailProvider');

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const messageId = `dev_${randomBytes(8).toString('hex')}`;
    this.logger.log(
      `[EMAIL:dev] to=${message.to} subject="${message.subject}" id=${messageId}`,
    );
    return { messageId, provider: this.name, accepted: true };
  }
}
