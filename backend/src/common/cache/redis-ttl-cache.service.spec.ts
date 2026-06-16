import { RedisTtlCacheService } from './redis-ttl-cache.service';

class TestCache extends RedisTtlCacheService {
  constructor() {
    super('test-cache', 1000);
  }
}

describe('RedisTtlCacheService', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.ENABLE_REDIS_CACHE_IN_TEST;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('uses memory cache in test/dev when Redis is not configured', async () => {
    const cache = new TestCache();
    const loader = jest.fn().mockResolvedValue({ ok: true });

    await expect(cache.wrap('key', loader)).resolves.toEqual({ ok: true });
    await expect(cache.wrap('key', loader)).resolves.toEqual({ ok: true });

    expect(cache.activeDriver).toBe('memory');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invalidates memory cache by prefix', async () => {
    const cache = new TestCache();
    const loader = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    await cache.wrap('tenant:a', loader);
    cache.invalidate('tenant:');
    await expect(cache.wrap('tenant:a', loader)).resolves.toBe(2);
  });

  it('fails fast in production when Redis is not configured', () => {
    process.env.NODE_ENV = 'production';

    expect(() => new TestCache()).toThrow(
      'test-cache requires REDIS_URL or REDIS_HOST in production',
    );
  });
});
