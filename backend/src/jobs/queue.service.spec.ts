import { QueueService } from './queue.service';
import { QUEUES } from './queue.constants';

/** Wait for the in-memory queue's microtask/setImmediate to flush. */
const flush = () => new Promise((r) => setImmediate(r));

describe('QueueService (in-memory driver)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    jest.dontMock('bullmq');
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('selects the memory driver when no Redis is configured', () => {
    const svc = new QueueService();
    svc.onModuleInit();
    expect(svc.activeDriver).toBe('memory');
  });

  it('fails fast in production when Redis is not configured', () => {
    process.env.NODE_ENV = 'production';
    const svc = new QueueService();

    expect(() => svc.onModuleInit()).toThrow(
      'REDIS_URL or REDIS_HOST is required in production for QueueService',
    );
  });

  it('processes an enqueued job asynchronously via the registered handler', async () => {
    const svc = new QueueService();
    svc.onModuleInit();
    const handler = jest.fn();
    svc.register(QUEUES.NOTIFICATIONS, handler);

    await svc.enqueue(QUEUES.NOTIFICATIONS, 'dispatch', { x: 1 });
    // not called synchronously
    expect(handler).not.toHaveBeenCalled();

    await flush();
    expect(handler).toHaveBeenCalledWith({ name: 'dispatch', data: { x: 1 } });
  });

  it('drops a job (warns) when no handler is registered, without throwing', async () => {
    const svc = new QueueService();
    svc.onModuleInit();
    await expect(
      svc.enqueue(QUEUES.EMAIL, 'email', { to: 'x' }),
    ).resolves.toBeUndefined();
    await flush();
  });

  it('does not let a handler error escape the enqueue call', async () => {
    const svc = new QueueService();
    svc.onModuleInit();
    svc.register(QUEUES.NOTIFICATIONS, () => {
      throw new Error('boom');
    });
    await expect(
      svc.enqueue(QUEUES.NOTIFICATIONS, 'dispatch', {}),
    ).resolves.toBeUndefined();
    await flush();
  });

  it('schedules delayed jobs with a timer (reminders)', async () => {
    jest.useFakeTimers();
    const svc = new QueueService();
    svc.onModuleInit();
    const handler = jest.fn();
    svc.register(QUEUES.REMINDERS, handler);

    await svc.enqueue(QUEUES.REMINDERS, 'reminder', { id: 1 }, { delayMs: 1000 });
    expect(handler).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    jest.useRealTimers();
    await flush();
    expect(handler).toHaveBeenCalled();
  });

  it('uses the memory driver even if REDIS_HOST is set but bullmq import fails gracefully', () => {
    process.env.REDIS_HOST = '127.0.0.1';
    jest.doMock('bullmq', () => {
      throw new Error('module not installed');
    });

    // Memory fallback is the safety net; without a reachable redis the driver
    // may still initialise bullmq lazily, so we only assert it does not throw.
    const svc = new QueueService();
    expect(() => svc.onModuleInit()).not.toThrow();
    expect(svc.activeDriver).toBe('memory');
  });

  it('fails fast in production when BullMQ cannot initialize', () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_HOST = '127.0.0.1';
    jest.doMock('bullmq', () => {
      throw new Error('module not installed');
    });

    const svc = new QueueService();

    expect(() => svc.onModuleInit()).toThrow(
      'BullMQ queue initialization failed in production: module not installed',
    );
  });
});
