import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Resend } from 'resend';

import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from './email-provider.interface';

@Injectable()
export class ProductionEmailProvider implements EmailProvider, OnModuleInit {
  readonly name = 'resend';
  private readonly logger = new Logger('ProductionEmailProvider');
  private client: Resend | null = null;

  onModuleInit() {
    if (process.env.EMAIL_PROVIDER !== 'production') return;
    this.validateConfig();
    this.client = new Resend(process.env.RESEND_API_KEY);
    this.logger.log('Production email provider configured with Resend.');
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const client = this.getClient();
    const from = this.requiredEnv('EMAIL_FROM');
    const replyTo = message.replyTo ?? process.env.EMAIL_REPLY_TO;

    const { data, error } = await client.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo,
    });

    if (error) {
      throw new Error(`Resend email delivery failed: ${error.message}`);
    }

    if (!data?.id) {
      throw new Error('Resend email delivery did not return a message id');
    }

    return { messageId: data.id, provider: this.name, accepted: true };
  }

  private getClient(): Resend {
    if (!this.client) {
      this.validateConfig();
      this.client = new Resend(process.env.RESEND_API_KEY);
    }
    return this.client;
  }

  private validateConfig(): void {
    this.requiredEnv('RESEND_API_KEY');
    this.requiredEnv('EMAIL_FROM');
  }

  private requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`${name} is required when EMAIL_PROVIDER=production`);
    }
    return value;
  }
}
