import { ErrorTrackingService } from './error-tracking.service';

describe('ErrorTrackingService', () => {
  const originalDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
  });

  it('is disabled and acts as a no-op when SENTRY_DSN is not set', async () => {
    delete process.env.SENTRY_DSN;
    const service = new ErrorTrackingService();
    service.onModuleInit();

    expect(service.isEnabled).toBe(false);
    // None of these should throw when tracking is disabled.
    expect(() => service.captureException(new Error('boom'))).not.toThrow();
    await expect(service.flush()).resolves.toBeUndefined();
  });

  it('never throws from captureException even with odd context', () => {
    delete process.env.SENTRY_DSN;
    const service = new ErrorTrackingService();
    service.onModuleInit();

    expect(() =>
      service.captureException('not-an-error', {
        requestId: 'abc',
        tenantId: null,
        method: 'GET',
        url: '/x',
        statusCode: 500,
      }),
    ).not.toThrow();
  });
});
