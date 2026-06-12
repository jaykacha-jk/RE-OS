import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, randomBytes } from 'crypto';

import type { AuthUser } from '../../common/context/auth-user';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import { CrmService } from '../crm/crm.service';
import { StorageService } from '../properties/storage/storage.service';
import {
  ALLOWED_ATTACHMENT_CONTENT_TYPES,
  ATTACHMENT_MAX_BYTES,
  CHAT_ASSIGN_ROLES,
  CHAT_FULL_ACCESS_ROLES,
  CHAT_TEAM_ACCESS_ROLES,
  CONVERSATION_ACTIVITY_TYPES,
  CONVERSATION_CLOSED_STATUSES,
  CONVERSATION_DEFAULT_PER_PAGE,
  MESSAGE_DEFAULT_PER_PAGE,
  type ConversationStatus,
} from './chat.constants';
import { ChatGateway } from './chat.gateway';
import { ChatRepository, type ConversationScope } from './chat.repository';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { CloseConversationDto } from './dto/close-conversation.dto';
import { ConvertInquiryDto } from './dto/convert-inquiry.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

type ConversationDetail = NonNullable<Awaited<ReturnType<ChatRepository['findById']>>>;
type ConversationBasic = NonNullable<Awaited<ReturnType<ChatRepository['findBasicById']>>>;

@Injectable()
export class ChatService {
  constructor(
    private readonly repo: ChatRepository,
    private readonly storage: StorageService,
    private readonly auditService: AuditService,
    private readonly events: DomainEventBus,
    private readonly gateway: ChatGateway,
    private readonly crm: CrmService,
  ) {}

  // ===========================================================================
  // RBAC scope
  // ===========================================================================

  async resolveScope(user: AuthUser, tenantId: string): Promise<ConversationScope> {
    if (user.roles.some((r) => CHAT_FULL_ACCESS_ROLES.includes(r))) {
      return { type: 'all' };
    }
    const employee = await this.repo.findEmployeeByUserId(tenantId, user.userId);
    if (!employee) return { type: 'employees', employeeIds: [] };

    if (user.roles.some((r) => CHAT_TEAM_ACCESS_ROLES.includes(r))) {
      const subordinates = await this.repo.findSubordinateEmployeeIds(employee.id);
      return { type: 'employees', employeeIds: [employee.id, ...subordinates] };
    }
    return { type: 'employees', employeeIds: [employee.id] };
  }

  private async assertCanAccess(
    user: AuthUser,
    tenantId: string,
    conversation: { id: string; assigned_employee_id: string | null },
  ) {
    if (user.roles.some((r) => CHAT_FULL_ACCESS_ROLES.includes(r))) return;

    const participant = await this.repo.findParticipant(conversation.id, user.userId);
    if (participant) return;

    const scope = await this.resolveScope(user, tenantId);
    if (scope.type === 'all') return;
    if (
      conversation.assigned_employee_id &&
      scope.employeeIds.includes(conversation.assigned_employee_id)
    ) {
      return;
    }
    throw new NotFoundException('Conversation not found');
  }

  private canAssign(user: AuthUser): boolean {
    return user.roles.some((r) => CHAT_ASSIGN_ROLES.includes(r));
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private async generateConversationCode(tenantId: string) {
    for (let i = 0; i < 25; i++) {
      const code = `CHT-${randomBytes(3).toString('hex').toUpperCase()}`;
      if (!(await this.repo.conversationCodeExists(tenantId, code))) return code;
    }
    return `CHT-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private async validateLinks(
    tenantId: string,
    propertyId?: string | null,
    inquiryId?: string | null,
    employeeId?: string | null,
  ) {
    if (propertyId) {
      const property = await this.repo.findPropertyById(tenantId, propertyId);
      if (!property) throw new BadRequestException('property_id is invalid for this tenant');
    }
    if (inquiryId) {
      const inquiry = await this.repo.findInquiryById(tenantId, inquiryId);
      if (!inquiry) throw new BadRequestException('inquiry_id is invalid for this tenant');
    }
    if (employeeId) {
      const employee = await this.repo.findEmployeeById(tenantId, employeeId);
      if (!employee) throw new BadRequestException('employee id is invalid for this tenant');
    }
  }

  private employeeName(rel: {
    user?: { first_name: string | null; last_name: string | null; email: string } | null;
  } | null | undefined): string | null {
    if (!rel?.user) return null;
    return (
      [rel.user.first_name, rel.user.last_name].filter(Boolean).join(' ') || rel.user.email || null
    );
  }

  private isUnread(
    lastMessageAt: Date | null | undefined,
    lastReadAt: Date | null | undefined,
  ): boolean {
    if (!lastMessageAt) return false;
    return !lastReadAt || lastReadAt < lastMessageAt;
  }

  private async recipientUserIds(conversationId: string): Promise<string[]> {
    return this.repo.listParticipantUserIds(conversationId);
  }

  private async pushUnreadBadges(tenantId: string, userIds: string[]) {
    const unique = [...new Set(userIds.filter(Boolean))];
    await Promise.all(
      unique.map(async (uid) => {
        const count = await this.repo.unreadConversationCount(tenantId, uid);
        this.gateway.emitUnreadCount(uid, count);
      }),
    );
  }

  // ===========================================================================
  // Mappers
  // ===========================================================================

  private mapMessage(m: {
    id: string;
    sender_type: string;
    sender_id: string | null;
    sender_name: string | null;
    message_type: string;
    content: string;
    status: string;
    created_at: Date;
    attachments?: {
      id: string;
      url: string;
      name: string;
      content_type: string | null;
      kind: string;
      size_bytes: bigint | null;
    }[];
  }) {
    return {
      id: m.id,
      sender_type: m.sender_type,
      sender_id: m.sender_id,
      sender_name: m.sender_name,
      message_type: m.message_type,
      content: m.content,
      status: m.status,
      attachments: (m.attachments ?? []).map((a) => ({
        id: a.id,
        url: a.url,
        name: a.name,
        content_type: a.content_type,
        kind: a.kind,
        size_bytes: a.size_bytes != null ? Number(a.size_bytes) : null,
      })),
      created_at: m.created_at.toISOString(),
    };
  }

  private mapListItem(
    c: ConversationBasic,
    unread?: boolean,
  ) {
    return {
      id: c.id,
      conversation_code: c.conversation_code,
      type: c.type,
      status: c.status,
      subject: c.subject,
      property_id: c.property_id,
      property_slug: c.property_slug,
      property: c.property
        ? {
            id: c.property.id,
            property_code: c.property.property_code,
            title: c.property.title,
            slug: c.property.slug,
            city: c.property.city,
          }
        : null,
      inquiry_id: c.inquiry_id,
      inquiry: c.inquiry
        ? { id: c.inquiry.id, inquiry_code: c.inquiry.inquiry_code, stage: c.inquiry.stage }
        : null,
      client_name: c.client_name,
      client_email: c.client_email,
      client_phone: c.client_phone,
      assigned_employee_id: c.assigned_employee_id,
      assigned_employee_name: this.employeeName(c.assigned_employee),
      last_message_at: c.last_message_at?.toISOString() ?? null,
      last_message_preview: c.last_message_preview,
      tags: c.tags?.map((t) => t.tag) ?? [],
      unread: unread ?? false,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
    };
  }

  private mapDetail(c: ConversationDetail, unread?: boolean) {
    return {
      ...this.mapListItem(c as unknown as ConversationBasic, unread),
      closed_at: c.closed_at?.toISOString() ?? null,
      participants: c.participants.map((p) => ({
        id: p.id,
        participant_type: p.participant_type,
        user_id: p.user_id,
        employee_id: p.employee_id,
        display_name: p.display_name,
        last_read_at: p.last_read_at?.toISOString() ?? null,
        joined_at: p.joined_at.toISOString(),
      })),
    };
  }

  // ===========================================================================
  // Conversations
  // ===========================================================================

  async create(
    tenantId: string,
    dto: CreateConversationDto,
    actor: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    await this.validateLinks(tenantId, dto.property_id, dto.inquiry_id, dto.assigned_employee_id);

    let propertySlug = dto.property_slug ?? null;
    if (dto.property_id && !propertySlug) {
      const property = await this.repo.findPropertyById(tenantId, dto.property_id);
      propertySlug = property?.slug ?? null;
    }

    const code = await this.generateConversationCode(tenantId);
    const type = dto.type ?? (dto.property_id ? 'property' : 'website');
    const status: ConversationStatus = dto.assigned_employee_id ? 'assigned' : 'open';

    const participants: {
      participant_type: string;
      user_id?: string | null;
      employee_id?: string | null;
      display_name?: string | null;
    }[] = [];

    // Creator (agent) joins internal/support threads.
    if (type === 'internal' || type === 'support') {
      const employee = await this.repo.findEmployeeByUserId(tenantId, actor.userId);
      participants.push({
        participant_type: 'employee',
        user_id: actor.userId,
        employee_id: employee?.id ?? null,
        display_name: null,
      });
    }

    if (dto.assigned_employee_id) {
      const assignee = await this.repo.findEmployeeById(tenantId, dto.assigned_employee_id);
      if (assignee) {
        participants.push({
          participant_type: 'employee',
          user_id: assignee.user_id,
          employee_id: assignee.id,
          display_name: null,
        });
      }
    }

    const data: Prisma.conversationsCreateInput = {
      tenant: { connect: { id: tenantId } },
      conversation_code: code,
      type,
      status,
      subject: dto.subject ?? null,
      client_name: dto.client_name ?? null,
      client_email: dto.client_email ?? null,
      client_phone: dto.client_phone ?? null,
      property_slug: propertySlug,
      created_by: actor.userId,
      ...(dto.property_id ? { property: { connect: { id: dto.property_id } } } : {}),
      ...(dto.inquiry_id ? { inquiry: { connect: { id: dto.inquiry_id } } } : {}),
      ...(dto.assigned_employee_id
        ? { assigned_employee: { connect: { id: dto.assigned_employee_id } } }
        : {}),
    };

    let assignedParticipant: { userId: string; employeeId: string } | null = null;
    if (dto.assigned_employee_id) {
      const assignee = await this.repo.findEmployeeById(tenantId, dto.assigned_employee_id);
      if (assignee) {
        assignedParticipant = { userId: assignee.user_id, employeeId: assignee.id };
      }
    }

    const id = await this.repo.createConversation({
      tenantId,
      data,
      participants,
      assignedEmployeeId: dto.assigned_employee_id ?? null,
      assignedParticipant,
      initialMessage: dto.initial_message
        ? {
            sender_type: 'employee',
            sender_id: actor.userId,
            sender_name: null,
            message_type: 'text',
            content: dto.initial_message.content,
          }
        : null,
      actorId: actor.userId,
    });

    const created = await this.repo.findById(tenantId, id);
    const mapped = this.mapDetail(created!);

    await this.auditService.record({
      actor,
      tenantId,
      action: 'chat.conversation.created',
      entityType: 'conversation',
      entityId: id,
      afterState: { conversation_code: mapped.conversation_code, type: mapped.type },
      meta,
    });

    this.events.emit(DOMAIN_EVENTS.CONVERSATION_CREATED, {
      tenantId,
      actorUserId: actor.userId,
      entityType: 'conversation',
      entityId: id,
      context: {
        conversationCode: mapped.conversation_code,
        clientName: mapped.client_name ?? 'Visitor',
      },
    });

    if (dto.assigned_employee_id) {
      const assignee = await this.repo.findEmployeeById(tenantId, dto.assigned_employee_id);
      this.events.emit(DOMAIN_EVENTS.CONVERSATION_ASSIGNED, {
        tenantId,
        actorUserId: actor.userId,
        entityType: 'conversation',
        entityId: id,
        context: {
          employeeId: dto.assigned_employee_id,
          conversationCode: mapped.conversation_code,
          clientName: mapped.client_name ?? 'Visitor',
        },
      });
      if (assignee) {
        this.gateway.emitAssigned({
          conversationId: id,
          recipientUserIds: [assignee.user_id],
          payload: mapped,
        });
      }
    }

    return mapped;
  }

  async list(tenantId: string, user: AuthUser, query: ListConversationsQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.per_page ?? CONVERSATION_DEFAULT_PER_PAGE;
    const scope = await this.resolveScope(user, tenantId);

    const where = this.repo.buildWhere(
      tenantId,
      {
        search: query.search,
        status: query['filter[status]'],
        type: query['filter[type]'],
        assignedEmployee: query['filter[assigned_employee]'],
        propertyId: query['filter[property]'],
        participantUserId: user.userId,
      },
      scope,
    );

    const { rows, total } = await this.repo.list({
      where,
      sortBy: query.sort_by ?? 'last_message_at',
      sortDir: query.sort_dir ?? 'desc',
      page,
      perPage,
    });

    const participantRows = await this.repo.findUserParticipants(
      user.userId,
      rows.map((r) => r.id),
    );
    const readMap = new Map(participantRows.map((p) => [p.conversation_id, p.last_read_at]));

    let data = rows.map((row) => {
      const unread = this.isUnread(row.last_message_at, readMap.get(row.id));
      return this.mapListItem(row as ConversationBasic, unread);
    });

    if (query['filter[unread]'] === 'true' || query['filter[unread]'] === '1') {
      data = data.filter((d) => d.unread);
    }
    if (query['filter[mine]'] === 'true' || query['filter[mine]'] === '1') {
      const employee = await this.repo.findEmployeeByUserId(tenantId, user.userId);
      data = data.filter(
        (d) =>
          d.assigned_employee_id === employee?.id ||
          participantRows.some((p) => p.conversation_id === d.id),
      );
    }

    return {
      data,
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) || 1 },
    };
  }

  async getOne(tenantId: string, user: AuthUser, id: string) {
    const conversation = await this.repo.findById(tenantId, id);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertCanAccess(user, tenantId, conversation);

    const participant = conversation.participants.find((p) => p.user_id === user.userId);
    const unread = this.isUnread(conversation.last_message_at, participant?.last_read_at);
    return this.mapDetail(conversation, unread);
  }

  async update(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: UpdateConversationDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Conversation not found');
    await this.assertCanAccess(user, tenantId, existing);

    const data: Prisma.conversationsUpdateInput = {};
    if (dto.subject !== undefined) data.subject = dto.subject ?? null;
    if (dto.client_name !== undefined) data.client_name = dto.client_name ?? null;
    if (dto.client_email !== undefined) data.client_email = dto.client_email ?? null;
    if (dto.client_phone !== undefined) data.client_phone = dto.client_phone ?? null;

    let activity: {
      activity_type: string;
      content?: string | null;
      metadata?: Prisma.InputJsonValue;
      actorId?: string | null;
    } | null = null;

    if (dto.status !== undefined && dto.status !== existing.status) {
      if (CONVERSATION_CLOSED_STATUSES.includes(dto.status as ConversationStatus)) {
        data.closed_at = new Date();
        data.closed_by = user.userId;
      }
      data.status = dto.status;
      activity = {
        activity_type: CONVERSATION_ACTIVITY_TYPES.STATUS_CHANGED,
        content: `Status changed to ${dto.status}`,
        metadata: { from: existing.status, to: dto.status } as Prisma.InputJsonValue,
        actorId: user.userId,
      };
    }

    await this.repo.updateConversation({
      tenantId,
      id,
      data,
      tags: dto.tags,
      activity,
    });

    const updated = await this.repo.findById(tenantId, id);
    const mapped = this.mapDetail(updated!);

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'chat.conversation.updated',
      entityType: 'conversation',
      entityId: id,
      meta,
    });

    const recipients = await this.recipientUserIds(id);
    this.gateway.emitConversationUpdated({ conversationId: id, recipientUserIds: recipients, payload: mapped });

    return mapped;
  }

  async assign(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: AssignConversationDto,
    meta?: AuditRequestMeta,
  ) {
    if (!this.canAssign(user)) {
      throw new ForbiddenException('You do not have permission to assign conversations');
    }

    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Conversation not found');

    const employee = await this.repo.findEmployeeById(tenantId, dto.employee_id);
    if (!employee) throw new BadRequestException('employee_id is invalid for this tenant');

    await this.repo.assign({
      tenantId,
      id,
      employeeId: dto.employee_id,
      previousEmployeeId: existing.assigned_employee_id,
      participantUserId: employee.user_id,
      participantName: null,
      actorId: user.userId,
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'chat.conversation.assigned',
      entityType: 'conversation',
      entityId: id,
      beforeState: { assigned_employee_id: existing.assigned_employee_id },
      afterState: { assigned_employee_id: dto.employee_id },
      meta,
    });

    this.events.emit(DOMAIN_EVENTS.CONVERSATION_ASSIGNED, {
      tenantId,
      actorUserId: user.userId,
      entityType: 'conversation',
      entityId: id,
      context: {
        employeeId: dto.employee_id,
        conversationCode: existing.conversation_code,
        clientName: existing.client_name ?? 'Visitor',
      },
    });

    const updated = await this.repo.findById(tenantId, id);
    const mapped = this.mapDetail(updated!);
    const recipients = await this.recipientUserIds(id);
    this.gateway.emitAssigned({
      conversationId: id,
      recipientUserIds: recipients,
      payload: mapped,
    });

    return mapped;
  }

  async close(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: CloseConversationDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Conversation not found');
    await this.assertCanAccess(user, tenantId, existing);

    const status: ConversationStatus = dto.archive ? 'archived' : 'closed';

    await this.repo.updateConversation({
      tenantId,
      id,
      data: {
        status,
        closed_at: new Date(),
        closed_by: user.userId,
      },
      activity: {
        activity_type: CONVERSATION_ACTIVITY_TYPES.CONVERSATION_CLOSED,
        content: dto.reason ?? 'Conversation closed',
        actorId: user.userId,
      },
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'chat.conversation.closed',
      entityType: 'conversation',
      entityId: id,
      afterState: { status },
      meta,
    });

    this.events.emit(DOMAIN_EVENTS.CONVERSATION_CLOSED, {
      tenantId,
      actorUserId: user.userId,
      entityType: 'conversation',
      entityId: id,
      context: {
        employeeId: existing.assigned_employee_id,
        conversationCode: existing.conversation_code,
        clientName: existing.client_name ?? 'Visitor',
      },
    });

    const updated = await this.repo.findById(tenantId, id);
    const mapped = this.mapDetail(updated!);
    const recipients = await this.recipientUserIds(id);
    this.gateway.emitClosed({ conversationId: id, recipientUserIds: recipients, payload: mapped });

    return mapped;
  }

  async convertToInquiry(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: ConvertInquiryDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Conversation not found');
    await this.assertCanAccess(user, tenantId, existing);

    let inquiryId = dto.inquiry_id ?? existing.inquiry_id ?? null;

    if (!inquiryId) {
      const phone = dto.phone ?? existing.client_phone;
      if (!phone) {
        throw new UnprocessableEntityException({
          code: 'BUSINESS_RULE_VIOLATION',
          message: 'A phone number is required to create an inquiry from this conversation',
          rule_id: 'BR-CH01',
        });
      }

      const inquiry = await this.crm.create(
        tenantId,
        {
          client_name: dto.client_name ?? existing.client_name ?? 'Chat Lead',
          phone,
          email: dto.email ?? existing.client_email ?? undefined,
          property_id: existing.property_id ?? undefined,
          assigned_employee_id: existing.assigned_employee_id ?? undefined,
          requirement_type: dto.requirement_type,
          source_name: 'Live Chat',
          override_duplicate: dto.override_duplicate,
        },
        user,
        meta,
      );
      inquiryId = inquiry.id;
    } else {
      const inquiry = await this.repo.findInquiryById(tenantId, inquiryId);
      if (!inquiry) throw new BadRequestException('inquiry_id is invalid for this tenant');
    }

    await this.repo.updateConversation({
      tenantId,
      id,
      data: {
        inquiry: { connect: { id: inquiryId } },
        type: existing.type === 'website' || existing.type === 'property' ? 'inquiry' : existing.type,
      },
      activity: {
        activity_type: CONVERSATION_ACTIVITY_TYPES.CONVERTED_TO_INQUIRY,
        content: `Linked to inquiry`,
        metadata: { inquiry_id: inquiryId } as Prisma.InputJsonValue,
        actorId: user.userId,
      },
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'chat.conversation.converted_inquiry',
      entityType: 'conversation',
      entityId: id,
      afterState: { inquiry_id: inquiryId },
      meta,
    });

    const updated = await this.repo.findById(tenantId, id);
    return this.mapDetail(updated!);
  }

  async unreadCount(tenantId: string, user: AuthUser) {
    const count = await this.repo.unreadConversationCount(tenantId, user.userId);
    return { count };
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  async listMessages(
    tenantId: string,
    user: AuthUser,
    conversationId: string,
    query: ListMessagesQueryDto,
  ) {
    const conversation = await this.repo.findBasicById(tenantId, conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertCanAccess(user, tenantId, conversation);

    const page = query.page ?? 1;
    const perPage = query.per_page ?? MESSAGE_DEFAULT_PER_PAGE;
    const { rows, total } = await this.repo.listMessages({
      tenantId,
      conversationId,
      page,
      perPage,
      before: query.before,
    });

    // Messages returned newest-first; UI typically reverses for chat bubble order.
    return {
      data: rows.map((m) => this.mapMessage(m)),
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) || 1 },
    };
  }

  async sendMessage(
    tenantId: string,
    user: AuthUser,
    conversationId: string,
    dto: SendMessageDto,
    meta?: AuditRequestMeta,
  ) {
    const conversation = await this.repo.findBasicById(tenantId, conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertCanAccess(user, tenantId, conversation);

    if (CONVERSATION_CLOSED_STATUSES.includes(conversation.status as ConversationStatus)) {
      throw new UnprocessableEntityException('Cannot send messages to a closed conversation');
    }

    const content = dto.content?.trim() ?? '';
    if (!content && (!dto.attachments || dto.attachments.length === 0)) {
      throw new BadRequestException('Message content or attachments are required');
    }

    const storedAttachments: {
      storage_key?: string | null;
      url: string;
      name: string;
      content_type?: string | null;
      kind: string;
      size_bytes?: number | null;
    }[] = [];

    for (const att of dto.attachments ?? []) {
      const bytes = this.storage.decodedByteLength(att.content_base64);
      if (bytes > ATTACHMENT_MAX_BYTES) {
        throw new UnprocessableEntityException({
          code: 'ATTACHMENT_TOO_LARGE',
          message: `Attachment "${att.name}" exceeds the ${ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB limit`,
        });
      }
      if (att.content_type && !ALLOWED_ATTACHMENT_CONTENT_TYPES.includes(att.content_type)) {
        throw new BadRequestException(`Unsupported attachment type: ${att.content_type}`);
      }
      const stored = await this.storage.saveChatAttachment({
        tenantId,
        conversationId,
        filename: att.name,
        contentBase64: att.content_base64,
        contentType: att.content_type,
      });
      storedAttachments.push({
        storage_key: stored.storageKey,
        url: stored.url,
        name: att.name,
        content_type: att.content_type ?? null,
        kind: att.kind,
        size_bytes: bytes,
      });
    }

    let messageType = dto.message_type ?? 'text';
    if (!dto.message_type && storedAttachments.length) {
      messageType = storedAttachments.every((a) => a.kind === 'image') ? 'image' : 'file';
    }

    const employee = await this.repo.findEmployeeByUserId(tenantId, user.userId);
    const senderName = this.employeeName(employee);

    const message = await this.repo.addMessage({
      tenantId,
      conversationId,
      sender: {
        sender_type: 'employee',
        sender_id: user.userId,
        sender_name: senderName,
      },
      messageType,
      content: content || (storedAttachments[0]?.name ?? ''),
      attachments: storedAttachments,
      senderParticipantUserId: user.userId,
    });

    const mapped = this.mapMessage(message);

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'chat.message.sent',
      entityType: 'message',
      entityId: message.id,
      afterState: { conversation_id: conversationId },
      meta,
    });

    const participants = await this.repo.listParticipantUserIds(conversationId);
    const notifyIds = participants.filter((uid) => uid !== user.userId);

    this.gateway.emitMessage({
      conversationId,
      recipientUserIds: notifyIds,
      message: mapped,
    });

    this.events.emit(DOMAIN_EVENTS.MESSAGE_RECEIVED, {
      tenantId,
      actorUserId: user.userId,
      entityType: 'conversation',
      entityId: conversationId,
      recipientUserIds: notifyIds,
      context: {
        conversationCode: conversation.conversation_code,
        clientName: conversation.client_name ?? 'Visitor',
        senderName: senderName ?? 'Agent',
        preview: mapped.content.slice(0, 120),
        employeeId: conversation.assigned_employee_id,
      },
    });

    await this.pushUnreadBadges(tenantId, notifyIds);

    return mapped;
  }

  async markMessageRead(
    tenantId: string,
    user: AuthUser,
    messageId: string,
    meta?: AuditRequestMeta,
  ) {
    const message = await this.repo.findMessageById(tenantId, messageId);
    if (!message) throw new NotFoundException('Message not found');

    const conversation = await this.repo.findBasicById(tenantId, message.conversation_id);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertCanAccess(user, tenantId, conversation);

    await this.repo.markRead({
      tenantId,
      conversationId: message.conversation_id,
      userId: user.userId,
      upToMessageId: messageId,
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'chat.message.read',
      entityType: 'message',
      entityId: messageId,
      meta,
    });

    const participants = await this.repo.listParticipantUserIds(message.conversation_id);
    const others = participants.filter((uid) => uid !== user.userId);

    this.gateway.emitRead({
      conversationId: message.conversation_id,
      userId: user.userId,
      readerUserIds: others,
    });

    if (message.sender_id && message.sender_id !== user.userId) {
      this.events.emit(DOMAIN_EVENTS.MESSAGE_READ, {
        tenantId,
        actorUserId: user.userId,
        entityType: 'conversation',
        entityId: message.conversation_id,
        recipientUserIds: [message.sender_id],
        context: {
          conversationCode: conversation.conversation_code,
          readerUserId: user.userId,
        },
      });
    }

    await this.pushUnreadBadges(tenantId, [user.userId]);

    return { message_id: messageId, status: 'read' };
  }

  // ===========================================================================
  // Timeline helpers (detail sidebar)
  // ===========================================================================

  async getActivities(tenantId: string, user: AuthUser, conversationId: string) {
    const conversation = await this.repo.findBasicById(tenantId, conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.assertCanAccess(user, tenantId, conversation);

    const [activities, assignments] = await Promise.all([
      this.repo.listActivities(tenantId, conversationId),
      this.repo.listAssignments(tenantId, conversationId),
    ]);

    return {
      activities: activities.map((a) => ({
        id: a.id,
        activity_type: a.activity_type,
        content: a.content,
        metadata: a.metadata,
        actor_id: a.actor_id,
        actor_email: a.actor_email,
        created_at: a.created_at.toISOString(),
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        employee_id: a.employee_id,
        employee_name: this.employeeName(a.employee),
        assigned_by: a.assigned_by,
        assigned_at: a.assigned_at.toISOString(),
      })),
    };
  }

  // ===========================================================================
  // Public widget token helpers (website messenger foundation)
  // ===========================================================================

  /** Issue an HMAC-signed access token for an anonymous website visitor. */
  issueClientToken(tenantId: string, conversationId: string, clientIdentifier: string): string {
    const secret = process.env.CHAT_CLIENT_TOKEN_SECRET ?? process.env.JWT_PRIVATE_KEY ?? 'dev-chat-secret';
    const payload = `${tenantId}:${conversationId}:${clientIdentifier}`;
    const sig = createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${sig}`).toString('base64url');
  }

  verifyClientToken(token: string): { tenantId: string; conversationId: string; clientIdentifier: string } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 4) return null;
      const [tenantId, conversationId, clientIdentifier, sig] = parts;
      const secret = process.env.CHAT_CLIENT_TOKEN_SECRET ?? process.env.JWT_PRIVATE_KEY ?? 'dev-chat-secret';
      const expected = createHmac('sha256', secret)
        .update(`${tenantId}:${conversationId}:${clientIdentifier}`)
        .digest('hex');
      if (sig !== expected) return null;
      return { tenantId, conversationId, clientIdentifier };
    } catch {
      return null;
    }
  }
}
