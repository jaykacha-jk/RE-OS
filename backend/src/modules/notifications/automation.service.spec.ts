import { AutomationService } from './automation.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';

function build() {
  const repo = {
    findEmployeeUserId: jest.fn(),
    findManagerUserId: jest.fn(),
    findOrgAdminUserIds: jest.fn().mockResolvedValue([]),
  };
  const notifications = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const bus = { on: jest.fn(), emit: jest.fn() };
  const service = new AutomationService(
    bus as unknown as DomainEventBus,
    repo as unknown as NotificationsRepository,
    notifications as unknown as NotificationsService,
  );
  return { service, repo, notifications, bus };
}

describe('AutomationService', () => {
  describe('onModuleInit', () => {
    it('subscribes a handler for every automation rule', () => {
      const { service, bus } = build();
      service.onModuleInit();
      expect(bus.on).toHaveBeenCalled();
    });
  });

  describe('handle — recipient resolution', () => {
    it('resolves the assigned employee and dispatches', async () => {
      const { service, repo, notifications } = build();
      repo.findEmployeeUserId.mockResolvedValue('user-emp');

      await service.handle(DOMAIN_EVENTS.LEAD_ASSIGNED, {
        tenantId: 't1',
        actorUserId: 'actor',
        entityType: 'inquiry',
        entityId: 'inq1',
        context: { employeeId: 'emp1' },
      });

      expect(repo.findEmployeeUserId).toHaveBeenCalledWith('emp1');
      expect(notifications.dispatch).toHaveBeenCalledTimes(1);
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-emp',
          eventKey: DOMAIN_EVENTS.LEAD_ASSIGNED,
          actionUrl: '/inquiries/inq1',
          type: 'CRM',
          priority: 'HIGH',
        }),
      );
    });

    it('excludes the actor when excludeActor is set', async () => {
      const { service, repo, notifications } = build();
      // assigned employee resolves to the actor → should be dropped
      repo.findEmployeeUserId.mockResolvedValue('actor');

      await service.handle(DOMAIN_EVENTS.LEAD_ASSIGNED, {
        tenantId: 't1',
        actorUserId: 'actor',
        entityType: 'inquiry',
        entityId: 'inq1',
        context: { employeeId: 'emp1' },
      });

      expect(notifications.dispatch).not.toHaveBeenCalled();
    });

    it('does not exclude actor for follow-up due (excludeActor false)', async () => {
      const { service, repo, notifications } = build();
      repo.findEmployeeUserId.mockResolvedValue('actor');

      await service.handle(DOMAIN_EVENTS.FOLLOWUP_DUE, {
        tenantId: 't1',
        actorUserId: 'actor',
        entityType: 'inquiry',
        entityId: 'inq1',
        context: { employeeId: 'emp1' },
        delayMs: 5000,
      });

      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'actor', delayMs: 5000 }),
      );
    });

    it('de-duplicates recipients across strategies (assigned + manager)', async () => {
      const { service, repo, notifications } = build();
      repo.findEmployeeUserId.mockResolvedValue('same-user');
      repo.findManagerUserId.mockResolvedValue('same-user');

      await service.handle(DOMAIN_EVENTS.FOLLOWUP_MISSED, {
        tenantId: 't1',
        actorUserId: 'other',
        entityType: 'inquiry',
        entityId: 'inq1',
        context: { employeeId: 'emp1' },
      });

      expect(notifications.dispatch).toHaveBeenCalledTimes(1);
    });

    it('resolves org admins for org_admins strategy', async () => {
      const { service, repo, notifications } = build();
      repo.findOrgAdminUserIds.mockResolvedValue(['a1', 'a2']);

      await service.handle(DOMAIN_EVENTS.INQUIRY_CREATED, {
        tenantId: 't1',
        actorUserId: 'actor',
        entityType: 'inquiry',
        entityId: 'inq1',
        context: {},
      });

      expect(repo.findOrgAdminUserIds).toHaveBeenCalledWith('t1');
      expect(notifications.dispatch).toHaveBeenCalledTimes(2);
    });

    it('uses explicit recipients for user invited', async () => {
      const { service, notifications } = build();
      await service.handle(DOMAIN_EVENTS.USER_INVITED, {
        tenantId: 't1',
        actorUserId: 'actor',
        entityType: 'user',
        entityId: 'u9',
        recipientUserIds: ['u9'],
        context: {},
      });
      expect(notifications.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u9', type: 'SYSTEM' }),
      );
    });

    it('does nothing when there are no recipients', async () => {
      const { service, repo, notifications } = build();
      repo.findEmployeeUserId.mockResolvedValue(null);
      await service.handle(DOMAIN_EVENTS.PROPERTY_ASSIGNED, {
        tenantId: 't1',
        entityType: 'property',
        entityId: 'p1',
        context: { employeeId: 'emp1' },
      });
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });
  });
});
