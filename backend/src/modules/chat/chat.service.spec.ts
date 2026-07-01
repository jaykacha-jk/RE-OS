import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import type { AuthUser } from '../../common/context/auth-user';
import { DomainEventBus } from '../../events/domain-event-bus';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../crm/crm.service';
import { QueueService } from '../../jobs/queue.service';
import { TenantConfigService } from '../settings/tenant-config.service';
import { RecaptchaService } from '../../common/security/recaptcha.service';
import { StorageService } from '../properties/storage/storage.service';
import { ChatGateway } from './chat.gateway';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';
import { issueClientToken, verifyClientToken } from './chat-visitor-token';

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
    unreadConversationCountsForUsers: jest.fn().mockImplementation((_tenantId: string, userIds: string[]) => {
      const counts = new Map<string, number>();
      for (const uid of userIds) counts.set(uid, 0);
      return Promise.resolve(counts);
    }),
    findParticipant: jest.fn(),
    markRead: jest.fn(),
    findMessageById: jest.fn(),
    updateConversation: jest.fn(),
    findInquiryById: jest.fn(),
    findOrganizationBySlug: jest.fn(),
    findPublicPropertyBySlug: jest.fn(),
    findOrgAdminUserIds: jest.fn().mockResolvedValue(['admin-user-1']),
    userHasFullChatAccess: jest.fn().mockResolvedValue(false),
    unreadConversationCountFullAccess: jest.fn().mockResolvedValue(0),
    createConversation: jest.fn(),
    conversationCodeExists: jest.fn().mockResolvedValue(false),
    findPropertyById: jest.fn(),
    list: jest.fn(),
    findUserParticipants: jest.fn().mockResolvedValue([]),
    listMessages: jest.fn(),
    listActivities: jest.fn().mockResolvedValue([]),
    listAssignments: jest.fn().mockResolvedValue([]),
    pickNextAssignableEmployee: jest.fn(),
    listChatAssignableEmployees: jest.fn(),
    updateConversation: jest.fn().mockResolvedValue(true),
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
  const crm = {
    create: jest.fn(),
    linkOrCreateInquiryFromChat: jest.fn().mockResolvedValue({
      inquiryId: 'inq-1',
      inquiry_code: 'INQ-001',
      created: true,
    }),
  };
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const tenantConfig = {
    getChatSettings: jest.fn().mockResolvedValue({
      auto_assign_enabled: true,
      auto_assign_delay_minutes: 5,
      auto_create_inquiry_on_phone: true,
    }),
  };

  const recaptcha = { assertValid: jest.fn().mockResolvedValue(undefined) };

  const service = new ChatService(
    repo as unknown as ChatRepository,
    storage as unknown as StorageService,
    audit as unknown as AuditService,
    events as unknown as DomainEventBus,
    gateway as unknown as ChatGateway,
    crm as unknown as CrmService,
    queue as unknown as QueueService,
    tenantConfig as unknown as TenantConfigService,
    recaptcha as unknown as RecaptchaService,
  );

  return { service, repo, storage, audit, events, gateway, crm, queue, tenantConfig, recaptcha };
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

function conversation(overrides: Record<string, unknown> = {}) {
  const date = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'conv-1',
    conversation_code: 'CHT-ABC',
    type: 'website',
    status: 'open',
    subject: 'Website inquiry',
    property_id: null,
    property_slug: null,
    property: null,
    inquiry_id: null,
    inquiry: null,
    client_name: 'Rahul',
    client_email: null,
    client_phone: null,
    client_identifier: 'visitor-1',
    assigned_employee_id: null,
    assigned_employee: null,
    last_message_at: null,
    last_message_preview: null,
    tags: [],
    participants: [],
    closed_at: null,
    created_at: date,
    updated_at: date,
    ...overrides,
  };
}

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    sender_type: 'client',
    sender_id: null,
    sender_name: 'Rahul',
    message_type: 'text',
    content: 'Hello',
    status: 'sent',
    attachments: [],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

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

  describe('public widget', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        CHAT_CLIENT_TOKEN_SECRET: 'test-chat-secret',
        JWT_PRIVATE_KEY: '',
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('starts a public conversation and returns a scoped visitor token', async () => {
      const { service, repo, audit, events, gateway, queue, crm } = build();
      repo.findOrganizationBySlug.mockResolvedValue({ id: 'tenant-1', slug: 'demo', status: 'active' });
      repo.createConversation.mockResolvedValue('conv-1');
      repo.findById.mockResolvedValue(conversation());
      repo.findOrgAdminUserIds.mockResolvedValue(['admin-user-1']);
      repo.listMessages.mockResolvedValue({ rows: [message()], total: 1 });

      const result = await service.startPublicConversation({
        tenant: 'demo',
        client_identifier: 'visitor-1',
        client_name: 'Rahul',
        client_phone: '+919876543210',
        message: 'I need help',
      });

      expect(repo.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          initialMessage: expect.objectContaining({
            sender_type: 'client',
            content: 'I need help',
          }),
        }),
      );
      expect(verifyClientToken(result.token)).toEqual({
        tenantId: 'tenant-1',
        conversationId: 'conv-1',
        clientIdentifier: 'visitor-1',
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actor: null }));
      expect(events.emit).toHaveBeenCalled();
      expect(gateway.emitMessage).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserIds: ['admin-user-1'] }),
      );
      expect(queue.enqueue).toHaveBeenCalled();
      expect(crm.linkOrCreateInquiryFromChat).toHaveBeenCalled();
    });

    it('performs round-robin auto-assign when still unassigned', async () => {
      const { service, repo, events, gateway } = build();
      repo.findById.mockResolvedValue(conversation({ assigned_employee_id: null }));
      repo.pickNextAssignableEmployee.mockResolvedValue({ id: 'emp-2', user_id: 'user-2' });
      repo.findById.mockResolvedValueOnce(conversation({ assigned_employee_id: null }));
      repo.findById.mockResolvedValueOnce(
        conversation({ assigned_employee_id: 'emp-2', status: 'assigned' }),
      );
      repo.findOrgAdminUserIds.mockResolvedValue([]);

      await service.performAutoAssign('tenant-1', 'conv-1');

      expect(repo.assign).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'emp-2', actorId: null }),
      );
      expect(events.emit).toHaveBeenCalled();
      expect(gateway.emitAssigned).toHaveBeenCalled();
    });

    it('skips auto-assign when conversation already has an assignee', async () => {
      const { service, repo } = build();
      repo.findById.mockResolvedValue(conversation({ assigned_employee_id: 'emp-1' }));

      await service.performAutoAssign('tenant-1', 'conv-1');

      expect(repo.assign).not.toHaveBeenCalled();
    });

    it('notifies org admins when an unassigned visitor sends a message', async () => {
      const { service, repo, gateway, events } = build();
      const token = issueClientToken('tenant-1', 'conv-1', 'visitor-1');
      repo.findBasicById.mockResolvedValue(conversation());
      repo.addMessage.mockResolvedValue(message({ content: 'Second message' }));
      repo.findOrgAdminUserIds.mockResolvedValue(['admin-user-1', 'admin-user-2']);

      await service.sendPublicMessage('conv-1', token, { content: 'Second message' });

      expect(gateway.emitMessage).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserIds: expect.arrayContaining(['admin-user-1']) }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'chat.message.received',
        expect.objectContaining({
          recipientUserIds: expect.arrayContaining(['admin-user-1']),
        }),
      );
    });

    it('reopens a closed conversation when the visitor sends a new message', async () => {
      const { service, repo } = build();
      const token = issueClientToken('tenant-1', 'conv-1', 'visitor-1');
      repo.findBasicById
        .mockResolvedValueOnce(conversation({ status: 'closed' }))
        .mockResolvedValueOnce(conversation({ status: 'open' }));
      repo.addMessage.mockResolvedValue(message());
      repo.findOrgAdminUserIds.mockResolvedValue([]);

      await service.sendPublicMessage('conv-1', token, { content: 'Hello again' });

      expect(repo.updateConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'open' }),
        }),
      );
    });

    it('sends public visitor messages only with the matching conversation token', async () => {
      const { service, repo, gateway } = build();
      const token = issueClientToken('tenant-1', 'conv-1', 'visitor-1');
      repo.findBasicById.mockResolvedValue(conversation());
      repo.addMessage.mockResolvedValue(message({ content: 'Second message' }));
      repo.findOrgAdminUserIds.mockResolvedValue(['agent-user-1']);

      const result = await service.sendPublicMessage('conv-1', token, { content: 'Second message' });

      expect(result.content).toBe('Second message');
      expect(repo.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          conversationId: 'conv-1',
          sender: expect.objectContaining({ sender_type: 'client' }),
        }),
      );
      expect(gateway.emitMessage).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserIds: ['agent-user-1'] }),
      );
    });

    it('rejects public messages with a token for another conversation', async () => {
      const { service } = build();
      const token = issueClientToken('tenant-1', 'other-conv', 'visitor-1');

      await expect(
        service.sendPublicMessage('conv-1', token, { content: 'Hello' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('client token secret', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('requires an explicit secret in production', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        CHAT_CLIENT_TOKEN_SECRET: '',
        JWT_PRIVATE_KEY: '',
      };
      expect(() => issueClientToken('tenant-1', 'conv-1', 'visitor-1')).toThrow(
        'CHAT_CLIENT_TOKEN_SECRET is required in production',
      );
    });

    it('issues and verifies tokens with the configured secret', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        CHAT_CLIENT_TOKEN_SECRET: 'test-chat-secret',
        JWT_PRIVATE_KEY: '',
      };

      const token = issueClientToken('tenant-1', 'conv-1', 'visitor-1');

      expect(verifyClientToken(token)).toEqual({
        tenantId: 'tenant-1',
        conversationId: 'conv-1',
        clientIdentifier: 'visitor-1',
      });
    });
  });
});
