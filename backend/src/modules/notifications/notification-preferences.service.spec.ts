import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsRepository } from './notifications.repository';
import { AUTOMATION_RULES } from './notifications.constants';
import { DOMAIN_EVENTS } from '../../events/domain-events';

function buildService() {
  const repo = {
    findPreference: jest.fn(),
    listPreferences: jest.fn().mockResolvedValue([]),
    upsertPreference: jest.fn().mockResolvedValue(undefined),
  };
  const service = new NotificationPreferencesService(
    repo as unknown as NotificationsRepository,
  );
  return { service, repo };
}

describe('NotificationPreferencesService', () => {
  describe('resolve', () => {
    it('defaults both channels ON when no stored preference', async () => {
      const { service, repo } = buildService();
      repo.findPreference.mockResolvedValue(null);
      await expect(service.resolve('u1', DOMAIN_EVENTS.LEAD_ASSIGNED)).resolves.toEqual({
        inApp: true,
        email: true,
      });
    });

    it('honours a stored preference (email OFF)', async () => {
      const { service, repo } = buildService();
      repo.findPreference.mockResolvedValue({ in_app: true, email: false });
      await expect(
        service.resolve('u1', DOMAIN_EVENTS.SITE_VISIT_REMINDER),
      ).resolves.toEqual({ inApp: true, email: false });
    });
  });

  describe('list', () => {
    it('returns one row per automation rule, defaulting to ON', async () => {
      const { service, repo } = buildService();
      repo.listPreferences.mockResolvedValue([]);
      const items = await service.list('u1');
      expect(items).toHaveLength(Object.keys(AUTOMATION_RULES).length);
      expect(items.every((i) => i.in_app && i.email)).toBe(true);
    });

    it('merges stored choices over defaults', async () => {
      const { service, repo } = buildService();
      repo.listPreferences.mockResolvedValue([
        { event_key: DOMAIN_EVENTS.LEAD_ASSIGNED, in_app: false, email: false },
      ]);
      const items = await service.list('u1');
      const lead = items.find((i) => i.event_key === DOMAIN_EVENTS.LEAD_ASSIGNED);
      expect(lead).toMatchObject({ in_app: false, email: false });
    });
  });

  describe('update', () => {
    it('upserts each preference then returns the full matrix', async () => {
      const { service, repo } = buildService();
      await service.update('u1', 't1', {
        preferences: [
          { event_key: DOMAIN_EVENTS.LEAD_ASSIGNED, in_app: true, email: false },
          { event_key: DOMAIN_EVENTS.FOLLOWUP_DUE, in_app: false, email: false },
        ],
      });
      expect(repo.upsertPreference).toHaveBeenCalledTimes(2);
      expect(repo.upsertPreference).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          tenantId: 't1',
          eventKey: DOMAIN_EVENTS.LEAD_ASSIGNED,
          email: false,
        }),
      );
    });
  });
});
