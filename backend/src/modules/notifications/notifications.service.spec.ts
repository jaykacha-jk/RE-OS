import { NotFoundException } from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsGateway } from './notifications.gateway';
import { QueueService } from '../../jobs/queue.service';
import { QUEUES } from '../../jobs/queue.constants';
import { DISPATCH_JOB, REMINDER_JOB } from './notifications.types';
import type { AuthUser } from '../../common/context/auth-user';

function build() {
  const repo = {
    createQueueEntry: jest.fn().mockResolvedValue(undefined),
    listForUser: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    countUnread: jest.fn().mockResolvedValue(0),
    findByIdForUser: jest.fn(),
    markRead: jest.fn().mockResolvedValue(undefined),
    markAllRead: jest.fn().mockResolvedValue(0),
  };
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const gateway = { emitRead: jest.fn(), emitUnreadCount: jest.fn() };
  const service = new NotificationsService(
    repo as unknown as NotificationsRepository,
    queue as unknown as QueueService,
    gateway as unknown as NotificationsGateway,
  );
  return { service, repo, queue, gateway };
}

const user: AuthUser = {
  userId: 'u1',
  tenantId: 't1',
  roles: ['sales_executive'],
  permissions: ['notifications.read'],
} as AuthUser;

describe('NotificationsService', () => {
  describe('dispatch', () => {
    it('enqueues to the notifications queue for immediate jobs', async () => {
      const { service, queue, repo } = build();
      await service.dispatch({
        tenantId: 't1',
        userId: 'u1',
        eventKey: 'crm.inquiry.assigned',
        type: 'CRM',
        priority: 'HIGH',
        channels: ['in_app', 'email'],
      });
      expect(repo.createQueueEntry).toHaveBeenCalled();
      expect(queue.enqueue).toHaveBeenCalledWith(
        QUEUES.NOTIFICATIONS,
        DISPATCH_JOB,
        expect.objectContaining({ userId: 'u1' }),
        expect.objectContaining({ delayMs: undefined }),
      );
    });

    it('routes delayed jobs to the reminders queue', async () => {
      const { service, queue } = build();
      await service.dispatch({
        tenantId: 't1',
        userId: 'u1',
        eventKey: 'crm.sitevisit.reminder',
        type: 'CRM',
        priority: 'HIGH',
        channels: ['in_app'],
        delayMs: 60000,
      });
      expect(queue.enqueue).toHaveBeenCalledWith(
        QUEUES.REMINDERS,
        REMINDER_JOB,
        expect.any(Object),
        expect.objectContaining({ delayMs: 60000 }),
      );
    });

    it('still enqueues when the outbox write fails (best-effort)', async () => {
      const { service, queue, repo } = build();
      repo.createQueueEntry.mockRejectedValue(new Error('db down'));
      await service.dispatch({
        tenantId: 't1',
        userId: 'u1',
        eventKey: 'x',
        type: 'CRM',
        priority: 'LOW',
        channels: ['in_app'],
      });
      expect(queue.enqueue).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('scopes by the authenticated user + tenant', async () => {
      const { service, repo } = build();
      await service.list(user, { page: 1, per_page: 20 } as any);
      expect(repo.listForUser).toHaveBeenCalledWith('u1', 't1', expect.any(Object));
    });

    it('clamps per_page to the maximum', async () => {
      const { service, repo } = build();
      await service.list(user, { per_page: 5000 } as any);
      const filters = repo.listForUser.mock.calls[0][2];
      expect(filters.perPage).toBeLessThanOrEqual(100);
    });
  });

  describe('markRead', () => {
    it('throws when the notification does not belong to the user', async () => {
      const { service, repo } = build();
      repo.findByIdForUser.mockResolvedValue(null);
      await expect(service.markRead(user, 'n1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('marks read + emits a realtime read event', async () => {
      const { service, repo, gateway } = build();
      repo.findByIdForUser.mockResolvedValue({ is_read: false });
      repo.countUnread.mockResolvedValue(2);
      const res = await service.markRead(user, 'n1');
      expect(repo.markRead).toHaveBeenCalledWith('n1', 'u1', 't1');
      expect(gateway.emitRead).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ id: 'n1', unread_count: 2 }),
      );
      expect(res).toMatchObject({ id: 'n1', is_read: true });
    });

    it('does not re-mark an already-read notification', async () => {
      const { service, repo } = build();
      repo.findByIdForUser.mockResolvedValue({ is_read: true });
      await service.markRead(user, 'n1');
      expect(repo.markRead).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('marks all read + emits all-read event', async () => {
      const { service, repo, gateway } = build();
      repo.markAllRead.mockResolvedValue(7);
      const res = await service.markAllRead(user);
      expect(res).toEqual({ updated: 7, unread_count: 0 });
      expect(gateway.emitRead).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ all: true, unread_count: 0 }),
      );
    });
  });
});
