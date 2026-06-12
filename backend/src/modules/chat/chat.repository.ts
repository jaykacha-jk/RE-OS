import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import { CONVERSATION_ACTIVITY_TYPES } from './chat.constants';

export type ConversationScope =
  | { type: 'all' }
  | { type: 'employees'; employeeIds: string[] };

export type ConversationListFilters = {
  search?: string;
  status?: string;
  type?: string;
  assignedEmployee?: string;
  propertyId?: string;
  participantUserId?: string;
  unreadForUserId?: string;
};

const employeeUserSelect = {
  user: { select: { first_name: true, last_name: true, email: true } },
} satisfies Prisma.employeesInclude;

const conversationInclude = {
  assigned_employee: { include: employeeUserSelect },
  property: { select: { id: true, property_code: true, title: true, slug: true, city: true } },
  inquiry: { select: { id: true, inquiry_code: true, stage: true } },
  tags: true,
} satisfies Prisma.conversationsInclude;

const conversationDetailInclude = {
  ...conversationInclude,
  participants: true,
} satisfies Prisma.conversationsInclude;

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Employees / scope -----------------------------------------------------

  async findEmployeeByUserId(tenantId: string, userId: string) {
    return this.prisma.dbClient.employees.findFirst({
      where: { user_id: userId, deleted_at: null, user: { tenant_id: tenantId, deleted_at: null } },
      include: employeeUserSelect,
    });
  }

  async findEmployeeById(tenantId: string, employeeId: string) {
    return this.prisma.dbClient.employees.findFirst({
      where: { id: employeeId, deleted_at: null, user: { tenant_id: tenantId, deleted_at: null } },
      include: employeeUserSelect,
    });
  }

  async findSubordinateEmployeeIds(managerEmployeeId: string) {
    const rows = await this.prisma.dbClient.employees.findMany({
      where: { manager_id: managerEmployeeId, deleted_at: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async findPropertyById(tenantId: string, propertyId: string) {
    return this.prisma.dbClient.properties.findFirst({
      where: { id: propertyId, tenant_id: tenantId, deleted_at: null },
      select: { id: true, slug: true, title: true },
    });
  }

  async findPublicPropertyBySlug(tenantId: string, slug: string) {
    return this.prisma.dbClient.properties.findFirst({
      where: {
        tenant_id: tenantId,
        slug,
        deleted_at: null,
        is_public: true,
        status: 'published',
      },
      select: { id: true, slug: true, title: true },
    });
  }

  async findOrganizationBySlug(slug: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { slug, deleted_at: null },
      select: { id: true, name: true, slug: true, status: true },
    });
  }

  async findInquiryById(tenantId: string, inquiryId: string) {
    return this.prisma.dbClient.inquiries.findFirst({
      where: { id: inquiryId, tenant_id: tenantId, deleted_at: null },
      select: { id: true, inquiry_code: true },
    });
  }

  // --- Uniqueness ------------------------------------------------------------

  async conversationCodeExists(tenantId: string, code: string) {
    const found = await this.prisma.dbClient.conversations.findFirst({
      where: { tenant_id: tenantId, conversation_code: code },
      select: { id: true },
    });
    return !!found;
  }

  // --- CRUD ------------------------------------------------------------------

  async createConversation(input: {
    tenantId: string;
    data: Prisma.conversationsCreateInput;
    participants: {
      participant_type: string;
      user_id?: string | null;
      employee_id?: string | null;
      display_name?: string | null;
    }[];
    tags?: string[];
    initialMessage?: {
      sender_type: string;
      sender_id?: string | null;
      sender_name?: string | null;
      message_type: string;
      content: string;
    } | null;
    assignedEmployeeId?: string | null;
    assignedParticipant?: { userId: string; employeeId: string; displayName?: string | null } | null;
    actorId?: string | null;
    actorEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const conversation = await tx.conversations.create({ data: input.data });

      if (input.participants.length) {
        await tx.conversation_participants.createMany({
          data: input.participants.map((p) => ({
            tenant_id: input.tenantId,
            conversation_id: conversation.id,
            participant_type: p.participant_type,
            user_id: p.user_id ?? null,
            employee_id: p.employee_id ?? null,
            display_name: p.display_name ?? null,
          })),
          skipDuplicates: true,
        });
      }

      if (input.tags?.length) {
        await tx.conversation_tags.createMany({
          data: input.tags.map((tag) => ({
            tenant_id: input.tenantId,
            conversation_id: conversation.id,
            tag,
          })),
          skipDuplicates: true,
        });
      }

      await tx.conversation_activities.create({
        data: {
          tenant_id: input.tenantId,
          conversation_id: conversation.id,
          activity_type: CONVERSATION_ACTIVITY_TYPES.CONVERSATION_CREATED,
          content: `Conversation ${conversation.conversation_code} created`,
          actor_id: input.actorId ?? null,
          actor_email: input.actorEmail ?? null,
        },
      });

      if (input.assignedEmployeeId) {
        await tx.conversation_assignments.create({
          data: {
            tenant_id: input.tenantId,
            conversation_id: conversation.id,
            employee_id: input.assignedEmployeeId,
            assigned_by: input.actorId ?? null,
          },
        });
        if (input.assignedParticipant) {
          await tx.conversation_participants.upsert({
            where: {
              conversation_id_user_id: {
                conversation_id: conversation.id,
                user_id: input.assignedParticipant.userId,
              },
            },
            create: {
              tenant_id: input.tenantId,
              conversation_id: conversation.id,
              participant_type: 'employee',
              user_id: input.assignedParticipant.userId,
              employee_id: input.assignedParticipant.employeeId,
              display_name: input.assignedParticipant.displayName ?? null,
            },
            update: { employee_id: input.assignedParticipant.employeeId },
          });
        }
        await tx.conversation_activities.create({
          data: {
            tenant_id: input.tenantId,
            conversation_id: conversation.id,
            activity_type: CONVERSATION_ACTIVITY_TYPES.CONVERSATION_ASSIGNED,
            content: 'Conversation assigned',
            metadata: { employee_id: input.assignedEmployeeId } as Prisma.InputJsonValue,
            actor_id: input.actorId ?? null,
            actor_email: input.actorEmail ?? null,
          },
        });
      }

      if (input.initialMessage) {
        const message = await tx.messages.create({
          data: {
            tenant_id: input.tenantId,
            conversation_id: conversation.id,
            sender_type: input.initialMessage.sender_type,
            sender_id: input.initialMessage.sender_id ?? null,
            sender_name: input.initialMessage.sender_name ?? null,
            message_type: input.initialMessage.message_type,
            content: input.initialMessage.content,
            status: 'sent',
          },
        });
        await tx.conversations.updateMany({
          where: { id: conversation.id, tenant_id: input.tenantId, deleted_at: null },
          data: {
            last_message_at: message.created_at,
            last_message_preview: input.initialMessage.content.slice(0, 200),
          },
        });
      }

      return conversation.id;
    });
  }

  async findById(tenantId: string, id: string) {
    return this.prisma.dbClient.conversations.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: conversationDetailInclude,
    });
  }

  async findBasicById(tenantId: string, id: string) {
    return this.prisma.dbClient.conversations.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: conversationInclude,
    });
  }

  buildWhere(
    tenantId: string,
    filters: ConversationListFilters,
    scope: ConversationScope,
  ): Prisma.conversationsWhereInput {
    const where: Prisma.conversationsWhereInput = { tenant_id: tenantId, deleted_at: null };
    const and: Prisma.conversationsWhereInput[] = [];

    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.propertyId) where.property_id = filters.propertyId;

    const search = filters.search?.trim();
    if (search) {
      and.push({
        OR: [
          { client_name: { contains: search, mode: 'insensitive' } },
          { client_email: { contains: search, mode: 'insensitive' } },
          { client_phone: { contains: search, mode: 'insensitive' } },
          { conversation_code: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // RBAC scope + explicit assignee filter intersect on assigned_employee_id.
    const scopeIds = scope.type === 'employees' ? scope.employeeIds : null;
    if (filters.assignedEmployee) {
      where.assigned_employee_id =
        scopeIds && !scopeIds.includes(filters.assignedEmployee)
          ? '00000000-0000-0000-0000-000000000000'
          : filters.assignedEmployee;
    } else if (scopeIds) {
      // Scoped users see conversations assigned to them/their team OR where they
      // are an explicit participant (e.g. added to an internal thread).
      const participantUserId = filters.participantUserId;
      and.push({
        OR: [
          {
            assigned_employee_id: scopeIds.length
              ? { in: scopeIds }
              : '00000000-0000-0000-0000-000000000000',
          },
          ...(participantUserId
            ? [{ participants: { some: { user_id: participantUserId } } }]
            : []),
        ],
      });
    }

    // NOTE: "unread" is a per-participant comparison against last_message_at
    // (cross-row) which Prisma cannot express in a single where clause; the
    // service filters unread results in-memory after the scoped query.

    if (and.length) where.AND = and;
    return where;
  }

  async list(input: {
    where: Prisma.conversationsWhereInput;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    page: number;
    perPage: number;
  }) {
    const orderBy: Prisma.conversationsOrderByWithRelationInput =
      input.sortBy === 'last_message_at'
        ? { last_message_at: { sort: input.sortDir, nulls: 'last' } }
        : { [input.sortBy]: input.sortDir };
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.conversations.findMany({
        where: input.where,
        include: conversationInclude,
        orderBy,
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.dbClient.conversations.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async updateConversation(input: {
    tenantId: string;
    id: string;
    data: Prisma.conversationsUpdateInput;
    tags?: string[] | null;
    activity?: {
      activity_type: string;
      content?: string | null;
      metadata?: Prisma.InputJsonValue;
      actorId?: string | null;
      actorEmail?: string | null;
    } | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const updated = await tx.conversations.updateMany({
        where: { id: input.id, tenant_id: input.tenantId, deleted_at: null },
        data: input.data,
      });
      if (updated.count !== 1) return false;

      if (input.tags) {
        await tx.conversation_tags.deleteMany({
          where: { conversation_id: input.id, tenant_id: input.tenantId },
        });
        if (input.tags.length) {
          await tx.conversation_tags.createMany({
            data: input.tags.map((tag) => ({
              tenant_id: input.tenantId,
              conversation_id: input.id,
              tag,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (input.activity) {
        await tx.conversation_activities.create({
          data: {
            tenant_id: input.tenantId,
            conversation_id: input.id,
            activity_type: input.activity.activity_type,
            content: input.activity.content ?? null,
            metadata: input.activity.metadata ?? {},
            actor_id: input.activity.actorId ?? null,
            actor_email: input.activity.actorEmail ?? null,
          },
        });
      }
      return true;
    });
  }

  async softDelete(tenantId: string, id: string) {
    const existing = await this.prisma.dbClient.conversations.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!existing) return false;
    await this.prisma.dbClient.conversations.updateMany({
      where: { id, tenant_id: tenantId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return true;
  }

  // --- Assignment ------------------------------------------------------------

  async assign(input: {
    tenantId: string;
    id: string;
    employeeId: string;
    previousEmployeeId: string | null;
    participantUserId: string | null;
    participantName: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const updated = await tx.conversations.updateMany({
        where: { id: input.id, tenant_id: input.tenantId, deleted_at: null },
        data: {
          assigned_employee_id: input.employeeId,
          status: 'assigned',
        },
      });
      if (updated.count !== 1) return false;
      await tx.conversation_assignments.create({
        data: {
          tenant_id: input.tenantId,
          conversation_id: input.id,
          employee_id: input.employeeId,
          assigned_by: input.actorId ?? null,
        },
      });
      if (input.participantUserId) {
        await tx.conversation_participants.upsert({
          where: {
            conversation_id_user_id: {
              conversation_id: input.id,
              user_id: input.participantUserId,
            },
          },
          create: {
            tenant_id: input.tenantId,
            conversation_id: input.id,
            participant_type: 'employee',
            user_id: input.participantUserId,
            employee_id: input.employeeId,
            display_name: input.participantName,
          },
          update: { employee_id: input.employeeId, tenant_id: input.tenantId },
        });
      }
      await tx.conversation_activities.create({
        data: {
          tenant_id: input.tenantId,
          conversation_id: input.id,
          activity_type: CONVERSATION_ACTIVITY_TYPES.CONVERSATION_ASSIGNED,
          content: 'Conversation assigned',
          metadata: {
            from: input.previousEmployeeId,
            to: input.employeeId,
          } as Prisma.InputJsonValue,
          actor_id: input.actorId ?? null,
          actor_email: input.actorEmail ?? null,
        },
      });
      return true;
    });
  }

  // --- Messages --------------------------------------------------------------

  async addMessage(input: {
    tenantId: string;
    conversationId: string;
    sender: {
      sender_type: string;
      sender_id?: string | null;
      sender_name?: string | null;
    };
    messageType: string;
    content: string;
    attachments?: {
      storage_key?: string | null;
      url: string;
      name: string;
      content_type?: string | null;
      kind: string;
      size_bytes?: number | null;
    }[];
    senderParticipantUserId?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const message = await tx.messages.create({
        data: {
          tenant_id: input.tenantId,
          conversation_id: input.conversationId,
          sender_type: input.sender.sender_type,
          sender_id: input.sender.sender_id ?? null,
          sender_name: input.sender.sender_name ?? null,
          message_type: input.messageType,
          content: input.content,
          status: 'sent',
        },
      });

      if (input.attachments?.length) {
        await tx.message_attachments.createMany({
          data: input.attachments.map((a) => ({
            tenant_id: input.tenantId,
            message_id: message.id,
            storage_key: a.storage_key ?? null,
            url: a.url,
            name: a.name,
            content_type: a.content_type ?? null,
            kind: a.kind,
            size_bytes: a.size_bytes != null ? BigInt(a.size_bytes) : null,
          })),
        });
      }

      const preview =
        input.content?.trim()?.length
          ? input.content.slice(0, 200)
          : input.attachments?.length
            ? `📎 ${input.attachments[0].name}`
            : '';

      await tx.conversations.updateMany({
        where: { id: input.conversationId, tenant_id: input.tenantId, deleted_at: null },
        data: {
          last_message_at: message.created_at,
          last_message_preview: preview,
        },
      });

      // Mark the sender's own participant row as read up to this message.
      if (input.senderParticipantUserId) {
        await tx.conversation_participants.updateMany({
          where: {
            conversation_id: input.conversationId,
            tenant_id: input.tenantId,
            user_id: input.senderParticipantUserId,
          },
          data: { last_read_at: message.created_at, last_read_message_id: message.id },
        });
      }

      const full = await tx.messages.findUnique({
        where: { id: message.id },
        include: { attachments: true },
      });
      return full!;
    });
  }

  async findMessageById(tenantId: string, messageId: string) {
    return this.prisma.dbClient.messages.findFirst({
      where: { id: messageId, tenant_id: tenantId, deleted_at: null },
      include: { attachments: true },
    });
  }

  async listMessages(input: {
    tenantId: string;
    conversationId: string;
    page: number;
    perPage: number;
    before?: string;
  }) {
    const where: Prisma.messagesWhereInput = {
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      deleted_at: null,
    };
    if (input.before) {
      const cursor = await this.prisma.dbClient.messages.findUnique({
        where: { id: input.before },
        select: { created_at: true },
      });
      if (cursor) where.created_at = { lt: cursor.created_at };
    }
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.messages.findMany({
        where,
        include: { attachments: true },
        orderBy: { created_at: 'desc' },
        skip: input.before ? 0 : (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.dbClient.messages.count({ where }),
    ]);
    return { rows, total };
  }

  /** Mark inbound messages as read for a participant up to `now`. */
  async markRead(input: {
    tenantId: string;
    conversationId: string;
    userId: string;
    upToMessageId?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const now = new Date();
      await tx.conversation_participants.updateMany({
        where: { conversation_id: input.conversationId, tenant_id: input.tenantId, user_id: input.userId },
        data: { last_read_at: now, last_read_message_id: input.upToMessageId ?? null },
      });
      // Flip status on messages authored by others to "read".
      await tx.messages.updateMany({
        where: {
          conversation_id: input.conversationId,
          tenant_id: input.tenantId,
          status: { in: ['sent', 'delivered'] },
          NOT: { sender_id: input.userId },
        },
        data: { status: 'read' },
      });
      return now;
    });
  }

  async markMessageRead(tenantId: string, messageId: string) {
    await this.prisma.dbClient.messages.updateMany({
      where: { id: messageId, tenant_id: tenantId, deleted_at: null },
      data: { status: 'read' },
    });
  }

  // --- Participants ----------------------------------------------------------

  async findParticipant(conversationId: string, userId: string) {
    return this.prisma.dbClient.conversation_participants.findFirst({
      where: { conversation_id: conversationId, user_id: userId },
    });
  }

  async listParticipants(tenantId: string, conversationId: string) {
    return this.prisma.dbClient.conversation_participants.findMany({
      where: { tenant_id: tenantId, conversation_id: conversationId },
      orderBy: { joined_at: 'asc' },
    });
  }

  async listParticipantUserIds(conversationId: string) {
    const rows = await this.prisma.dbClient.conversation_participants.findMany({
      where: { conversation_id: conversationId, user_id: { not: null } },
      select: { user_id: true },
    });
    return rows.map((r) => r.user_id!).filter(Boolean);
  }

  /** Read state for a single user across a set of conversations (list unread badges). */
  async findUserParticipants(userId: string, conversationIds: string[]) {
    if (!conversationIds.length) return [];
    return this.prisma.dbClient.conversation_participants.findMany({
      where: { user_id: userId, conversation_id: { in: conversationIds } },
      select: { conversation_id: true, last_read_at: true },
    });
  }

  // --- Unread counts ---------------------------------------------------------

  /**
   * Number of conversations that have messages newer than the participant's
   * last_read_at (i.e. conversations with unread activity for this user).
   */
  async unreadConversationCount(tenantId: string, userId: string) {
    const rows = await this.prisma.dbClient.conversation_participants.findMany({
      where: {
        tenant_id: tenantId,
        user_id: userId,
        conversation: { deleted_at: null, last_message_at: { not: null } },
      },
      select: {
        last_read_at: true,
        conversation: { select: { last_message_at: true } },
      },
    });
    return rows.filter((r) => {
      const last = r.conversation.last_message_at;
      if (!last) return false;
      return !r.last_read_at || r.last_read_at < last;
    }).length;
  }

  // --- Activities ------------------------------------------------------------

  async listActivities(tenantId: string, conversationId: string) {
    return this.prisma.dbClient.conversation_activities.findMany({
      where: { tenant_id: tenantId, conversation_id: conversationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async listAssignments(tenantId: string, conversationId: string) {
    return this.prisma.dbClient.conversation_assignments.findMany({
      where: { tenant_id: tenantId, conversation_id: conversationId },
      orderBy: { assigned_at: 'desc' },
      include: { employee: { include: employeeUserSelect } },
    });
  }
}
