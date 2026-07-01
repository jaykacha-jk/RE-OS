import { BadRequestException, Injectable, Logger } from '@nestjs/common';

type SiteVerifyResponse = {
  success?: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
};

/**
 * Optional Google reCAPTCHA v3 verification for public endpoints.
 * When RECAPTCHA_SECRET_KEY is unset, verification is skipped (dev-friendly).
 */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  isEnabled(): boolean {
    return Boolean(process.env.RECAPTCHA_SECRET_KEY?.trim());
  }

  async assertValid(token: string | undefined, remoteIp?: string, minScore = 0.5): Promise<void> {
    const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
    if (!secret) return;

    if (!token?.trim()) {
      throw new BadRequestException('reCAPTCHA verification is required');
    }

    const params = new URLSearchParams({
      secret,
      response: token.trim(),
    });
    if (remoteIp) params.set('remoteip', remoteIp);

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const payload = (await response.json().catch(() => null)) as SiteVerifyResponse | null;
    const ok =
      payload?.success === true &&
      (payload.score === undefined || payload.score >= minScore);

    if (!ok) {
      this.logger.warn(
        `reCAPTCHA failed errors=${payload?.['error-codes']?.join(',') ?? 'unknown'} score=${payload?.score ?? 'n/a'}`,
      );
      throw new BadRequestException('reCAPTCHA verification failed');
    }
  }
}
