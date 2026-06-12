import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import type { AuthUser } from '../../common/context/auth-user';
import { DomainEventBus } from '../../events/domain-event-bus';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../crm/crm.service';
import { StorageService } from '../properties/storage/storage.service';
import { ChatGateway } from './chat.gateway';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';

function build() {
  const repo = {
    findEmployeeByUserId: jest.fn(),
    findEmployeeById: jest.fn(),
    findSubordinateEmployeeIds: jest.fn().mockResolvedValue([]),
    findBasicById: jest.fn(),
    findById: jest.fn(),
    listParticipantUserIds: jest.fn().mockResolvedValue([]),
    addMessage: jest.fn(),
    assign: jest.fn(),
    unreadConversationCount: jest.fn().mockResolvedValue(0),
    findParticipant: jest.fn(),
    markRead: jest.fn(),
    findMessageById: jest.fn(),
    updateConversation: jest.fn(),
    findInquiryById: jest.fn(),
    createConversation: jest.fn(),
    conversationCodeExists: jest.fn().mockResolvedValue(false),
    findPropertyById: jest.fn(),
    list: jest.fn(),
    findUserParticipants: jest.fn().mockResolvedValue([]),
    listMessages: jest.fn(),
    listActivities: jest.fn().mockResolvedValue([]),
    listAssignments: jest.fn().mockResolvedValue([]),
  };
  const storage = {
    decodedByteLength: jest.fn().mockReturnValue(100),
    saveChatAttachment: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const events = { emit: jest.fn() };
  const gateway = {
    emitMessage: jest.fn(),
    emitAssigned: jest.fn(),
    emitClosed: jest.fn(),
    emitConversationUpdated: jest.fn(),
    emitRead: jest.fn(),
    emitUnreadCount: jest.fn(),
  };
  const crm = { create: jest.fn() };

  const service = new ChatService(
    repo as unknown as ChatRepository,
    storage as unknown as StorageService,
    audit as unknown as AuditService,
    events as unknown as DomainEventBus,
    gateway as unknown as ChatGateway,
    crm as unknown as CrmService,
  );

  return { service, repo, storage, audit, events, gateway, crm };
}

const owner: AuthUser = {
  userId: 'owner-1',
  tenantId: 'tenant-1',
  roles: ['org_owner'],
  permissions: ['chat.conversations.assign'],
};

const executive: AuthUser = {
  userId: 'exec-1',
  tenantId: 'tenant-1',
  roles: ['sales_executive'],
  permissions: [],
};

describe('ChatService', () => {
  describe('resolveScope', () => {
    it('returns all scope for org_owner', async () => {
      const { service } = build();
      await expect(service.resolveScope(owner, 'tenant-1')).resolves.toEqual({ type: 'all' });
    });

    it('returns employee scope for sales executive', async () => {
      const { service, repo } = build();
      repo.findEmployeeByUserId.mockResolvedValue({ id: 'emp-1' });
      await expect(service.resolveScope(executive, 'tenant-1')).resolves.toEqual({
        type: 'employees',
        employeeIds: ['emp-1'],
      });
    });
  });

  describe('assign', () => {
    it('rejects assign when user lacks assign role', async () => {
      const { service } = build();
      await expect(
        service.assign('tenant-1', executive, 'conv-1', { employee_id: 'emp-2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('assigns conversation for org_owner', async () => {
      const { service, repo, events } = build();
      repo.findById.mockResolvedValue({
        id: 'conv-1',
        conversation_code: 'CHT-ABC',
        client_name: 'Rahul',
        assigned_employee_id: null,
        participants: [],
        tags: [],
      });
      repo.findEmployeeById.mockResolvedValue({ id: 'emp-2', user_id: 'user-2', user: { email: 'a@b.com' } });
      repo.findById.mockResolvedValueOnce({
        id: 'conv-1',
        conversation_code: 'CHT-ABC',
        client_name: 'Rahul',
        assigned_employee_id: null,
        participants: [],
        tags: [],
      });
      repo.findById.mockResolvedValueOnce({
        id: 'conv-1',
        conversation_code: 'CHT-ABC',
        client_name: 'Rahul',
        assigned_employee_id: 'emp-2',
        participants: [],
        tags: [],
        property: null,
        inquiry: null,
        assigned_employee: null,
        last_message_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await service.assign('tenant-1', owner, 'conv-1', { employee_id: 'emp-2' });
      expect(repo.assign).toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('rejects messages on closed conversations', async () => {
      const { service, repo } = build();
      repo.findBasicById.mockResolvedValue({
        id: 'conv-1',
        status: 'closed',
        assigned_employee_id: 'emp-1',
        conversation_code: 'CHT-X',
        client_name: 'Test',
      });
      repo.findParticipant.mockResolvedValue({ user_id: owner.userId });

      await expect(
        service.sendMessage('tenant-1', owner, 'conv-1', { content: 'Hi' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('getOne', () => {
    it('hides conversations outside RBAC scope', async () => {
      const { service, repo } = build();
      repo.findById.mockResolvedValue({
        id: 'conv-1',
        assigned_employee_id: 'emp-other',
        participants: [],
      });
      repo.findParticipant.mockResolvedValue(null);
      repo.findEmployeeByUserId.mockResolvedValue({ id: 'emp-1' });

      await expect(service.getOne('tenant-1', executive, 'conv-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('convertToInquiry', () => {
    it('requires phone when creating a new inquiry', async () => {
      const { service, repo } = build();
      repo.findById.mockResolvedValue({
        id: 'conv-1',
        inquiry_id: null,
        client_phone: null,
        client_name: 'Visitor',
        assigned_employee_id: null,
        type: 'website',
        participants: [],
        tags: [],
      });

      await expect(
        service.convertToInquiry('tenant-1', owner, 'conv-1', {}),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
