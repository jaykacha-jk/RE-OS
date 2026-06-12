import { ConflictException, NotFoundException } from '@nestjs/common';

import { NotificationTemplatesService } from './notification-templates.service';
import { NotificationsRepository } from './notifications.repository';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../../common/context/auth-user';

function build() {
  const repo = {
    listTemplates: jest.fn().mockResolvedValue([]),
    findActiveTemplate: jest.fn(),
    createTemplate: jest.fn(),
    findTemplateById: jest.fn(),
    updateTemplate: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new NotificationTemplatesService(
    repo as unknown as NotificationsRepository,
    audit as unknown as AuditService,
  );
  return { service, repo, audit };
}

const actor: AuthUser = {
  userId: 'admin1',
  tenantId: 't1',
  roles: ['org_admin'],
  permissions: ['notifications.templates.manage'],
} as AuthUser;

const now = new Date();
const row = (over: Record<string, unknown> = {}) => ({
  id: 'tpl1',
  tenant_id: 't1',
  key: 'crm.inquiry.assigned',
  channel: 'in_app',
  type: 'CRM',
  priority: 'HIGH',
  title_template: 'T',
  body_template: 'B',
  email_subject_template: null,
  is_active: true,
  is_system: false,
  created_at: now,
  updated_at: now,
  ...over,
});

describe('NotificationTemplatesService', () => {
  describe('list', () => {
    it('returns custom templates plus system defaults', async () => {
      const { service, repo } = build();
      repo.listTemplates.mockResolvedValue([row()]);
      const res = await service.list('t1');
      expect(res.templates).toHaveLength(1);
      expect(res.system_defaults.length).toBeGreaterThan(0);
      expect(res.system_defaults[0]).toHaveProperty('is_system_default', true);
    });
  });

  describe('create', () => {
    it('creates a template + writes audit', async () => {
      const { service, repo, audit } = build();
      repo.findActiveTemplate.mockResolvedValue(null);
      repo.createTemplate.mockResolvedValue(row());
      const res = await service.create('t1', actor, {
        key: 'crm.inquiry.assigned',
        channel: 'in_app',
        type: 'CRM',
        title_template: 'T',
        body_template: 'B',
      } as any);
      expect(res.id).toBe('tpl1');
      expect(repo.createTemplate).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalled();
    });

    it('rejects a duplicate template for the same tenant + key + channel', async () => {
      const { service, repo } = build();
      repo.findActiveTemplate.mockResolvedValue(row({ tenant_id: 't1' }));
      await expect(
        service.create('t1', actor, {
          key: 'crm.inquiry.assigned',
          channel: 'in_app',
          type: 'CRM',
          title_template: 'T',
          body_template: 'B',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('throws when the template is not found in scope', async () => {
      const { service, repo } = build();
      repo.findTemplateById.mockResolvedValue(null);
      await expect(
        service.update('t1', actor, 'missing', { title_template: 'X' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates only provided fields', async () => {
      const { service, repo } = build();
      repo.findTemplateById.mockResolvedValue(row());
      repo.updateTemplate.mockResolvedValue(row({ title_template: 'X' }));
      await service.update('t1', actor, 'tpl1', { title_template: 'X' } as any);
      expect(repo.updateTemplate).toHaveBeenCalledWith(
        'tpl1',
        expect.objectContaining({ title_template: 'X' }),
      );
      // unspecified fields should not be in the patch
      const patch = repo.updateTemplate.mock.calls[0][1];
      expect(patch).not.toHaveProperty('priority');
    });
  });
});
