export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body (always present). */
  text: string;
  /** Optional HTML body. */
  html?: string;
  /** Optional reply-to override. */
  replyTo?: string;
  /** Tenant context for logging / multi-tenant from-address resolution. */
  tenantId?: string | null;
}

export interface EmailSendResult {
  /** Provider-assigned message id (or a synthetic id for the dev provider). */
  messageId: string;
  provider: string;
  accepted: boolean;
}

/**
 * Provider-agnostic email contract. Implementations: DevEmailProvider (local),
 * ProductionEmailProvider (SES/SendGrid/etc — wired in a later phase).
 */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
