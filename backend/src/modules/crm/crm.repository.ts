import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { INQUIRY_ACTIVITY_TYPES, INQUIRY_HISTORY_TYPES } from './crm.constants';

export type InquiryScope = { type: 'all' } | { type: 'employees'; employeeIds: string[] };

export type InquiryListFilters = {
  search?: string;
  stage?: string;
  priority?: string;
  temperature?: string;
  sourceId?: string;
  assignedEmployee?: string;
  propertyId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const employeeUserSelect = {
  user: { select: { first_name: true, last_name: true, email: true } },
} satisfies Prisma.employeesInclude;

const inquiryInclude = {
  assigned_employee: { include: employeeUserSelect },
  source: true,
  property: { select: { id: true, property_code: true, title: true, slug: true, city: true } },
} satisfies Prisma.inquiriesInclude;

const inquiryDetailInclude = {
  ...inquiryInclude,
  notes: { orderBy: { created_at: 'desc' as const } },
  followups: {
    orderBy: { followup_date: 'asc' as const },
    include: { employee: { include: employeeUserSelect } },
  },
  site_visits: {
    orderBy: { scheduled_at: 'desc' as const },
    include: {
      employee: { include: employeeUserSelect },
      property: { select: { id: true, property_code: true, title: true } },
    },
  },
} satisfies Prisma.inquiriesInclude;

@Injectable()
export class CrmRepository extends TenantScopedRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // --- Employees (scope + assignment) ----------------------------------------

  async findEmployeeByUserId(tenantId: string, userId: string) {
    return this.prisma.dbClient.employees.findFirst({
      where: { user_id: userId, deleted_at: null, user: { tenant_id: tenantId, deleted_at: null } },
    });
  }

  async findEmployeeById(tenantId: string, employeeId: string) {
    return this.prisma.dbClient.employees.findFirst({
      where: { id: employeeId, deleted_at: null, user: { tenant_id: tenantId, deleted_at: null } },
    });
  }

  async findSubordinateEmployeeIds(tenantId: string, managerEmployeeId: string) {
    const rows = await this.prisma.dbClient.employees.findMany({
      where: {
        manager_id: managerEmployeeId,
        deleted_at: null,
        user: { tenant_id: tenantId, deleted_at: null },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async findPropertyById(tenantId: string, propertyId: string) {
    return this.prisma.dbClient.properties.findFirst({
      where: { id: propertyId, tenant_id: tenantId, deleted_at: null },
      select: { id: true },
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
      select: {
        id: true,
        title: true,
        slug: true,
        city: true,
        category: true,
        requirement_type: true,
        bedrooms: true,
      },
    });
  }

  async findOrganizationBySlug(slug: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { slug, deleted_at: null },
      select: { id: true, name: true, slug: true, status: true },
    });
  }

  // --- Uniqueness / duplicate detection --------------------------------------

  async inquiryCodeExists(tenantId: string, code: string) {
    const found = await this.prisma.dbClient.inquiries.findFirst({
      where: { tenant_id: tenantId, inquiry_code: code },
      select: { id: true },
    });
    return !!found;
  }

  /** BR-C01: same phone with an open (non-terminal) stage within the window. */
  async findRecentOpenByPhone(tenantId: string, phone: string, since: Date) {
    return this.prisma.dbClient.inquiries.findFirst({
      where: {
        tenant_id: tenantId,
        phone,
        deleted_at: null,
        stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
        created_at: { gte: since },
      },
      select: { id: true, inquiry_code: true, created_at: true },
    });
  }

  // --- CRUD ------------------------------------------------------------------

  async createInquiry(input: {
    tenantId: string;
    data: Prisma.inquiriesCreateInput;
    assignedEmployeeId?: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const inquiry = await tx.inquiries.create({ data: input.data });

      await tx.inquiry_history.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: inquiry.id,
          change_type: INQUIRY_HISTORY_TYPES.CREATED,
          changed_fields: { stage: inquiry.stage } as Prisma.InputJsonValue,
          changed_by: input.actorId ?? null,
          changed_by_email: input.actorEmail ?? null,
        },
      });

      await tx.inquiry_activities.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: inquiry.id,
          activity_type: INQUIRY_ACTIVITY_TYPES.INQUIRY_CREATED,
          content: `Inquiry ${inquiry.inquiry_code} created`,
          actor_id: input.actorId ?? null,
          actor_email: input.actorEmail ?? null,
        },
      });

      if (input.assignedEmployeeId) {
        await tx.inquiry_assignments.create({
          data: {
            tenant_id: input.tenantId,
            inquiry_id: inquiry.id,
            employee_id: input.assignedEmployeeId,
            assigned_by: input.actorId ?? null,
          },
        });
        await tx.inquiry_activities.create({
          data: {
            tenant_id: input.tenantId,
            inquiry_id: inquiry.id,
            activity_type: INQUIRY_ACTIVITY_TYPES.INQUIRY_ASSIGNED,
            content: 'Inquiry assigned',
            metadata: { employee_id: input.assignedEmployeeId } as Prisma.InputJsonValue,
            actor_id: input.actorId ?? null,
            actor_email: input.actorEmail ?? null,
          },
        });
      }

      return inquiry.id;
    });
  }

  async findById(tenantId: string, id: string) {
    return this.prisma.dbClient.inquiries.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: inquiryDetailInclude,
    });
  }

  async findBasicById(tenantId: string, id: string) {
    return this.prisma.dbClient.inquiries.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: inquiryInclude,
    });
  }

  buildWhere(
    tenantId: string,
    filters: InquiryListFilters,
    scope: InquiryScope,
  ): Prisma.inquiriesWhereInput {
    const where: Prisma.inquiriesWhereInput = this.tenantWhere(tenantId, { deleted_at: null });

    if (filters.stage) where.stage = filters.stage;
    if (filters.priority) where.priority = filters.priority;
    if (filters.temperature) where.temperature = filters.temperature;
    if (filters.sourceId) where.source_id = filters.sourceId;
    if (filters.propertyId) where.property_id = filters.propertyId;

    if (filters.dateFrom || filters.dateTo) {
      where.created_at = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { client_name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { inquiry_code: { contains: search, mode: 'insensitive' } },
      ];
    }

    // RBAC scope + explicit assignee filter intersect on assigned_employee_id.
    const scopeIds = scope.type === 'employees' ? scope.employeeIds : null;
    if (filters.assignedEmployee === 'unassigned') {
      where.assigned_employee_id = null;
    } else if (filters.assignedEmployee) {
      where.assigned_employee_id =
        scopeIds && !scopeIds.includes(filters.assignedEmployee)
          ? '00000000-0000-0000-0000-000000000000'
          : filters.assignedEmployee;
    } else if (scopeIds) {
      where.assigned_employee_id = scopeIds.length ? { in: scopeIds } : '00000000-0000-0000-0000-000000000000';
    }

    return where;
  }

  async list(input: {
    where: Prisma.inquiriesWhereInput;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    page: number;
    perPage: number;
  }) {
    this.assertTenantWhere('CrmRepository.list', input.where as Record<string, unknown>);
    const orderBy: Prisma.inquiriesOrderByWithRelationInput = { [input.sortBy]: input.sortDir };
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.inquiries.findMany({
        where: input.where,
        include: inquiryInclude,
        orderBy,
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.dbClient.inquiries.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async updateInquiry(input: {
    tenantId: string;
    id: string;
    data: Prisma.inquiriesUpdateInput;
    historyEntries: {
      change_type: string;
      changed_fields: Prisma.InputJsonValue;
      changed_by?: string | null;
      changed_by_email?: string | null;
    }[];
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const updated = await tx.inquiries.updateMany({
        where: { id: input.id, tenant_id: input.tenantId, deleted_at: null },
        data: input.data,
      });
      if (updated.count !== 1) return false;
      for (const entry of input.historyEntries) {
        await tx.inquiry_history.create({
          data: {
            tenant_id: input.tenantId,
            inquiry_id: input.id,
            change_type: entry.change_type,
            changed_fields: entry.changed_fields,
            changed_by: entry.changed_by ?? null,
            changed_by_email: entry.changed_by_email ?? null,
          },
        });
      }
      return true;
    });
  }

  async softDelete(tenantId: string, id: string) {
    const existing = await this.prisma.dbClient.inquiries.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!existing) return false;
    await this.prisma.dbClient.inquiries.updateMany({
      where: { id, tenant_id: tenantId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return true;
  }

  // --- Stage workflow --------------------------------------------------------

  async changeStage(input: {
    tenantId: string;
    id: string;
    data: Prisma.inquiriesUpdateInput;
    fromStage: string;
    toStage: string;
    activityType: string;
    changedFields?: Prisma.InputJsonObject;
    actorId?: string | null;
    actorEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const updated = await tx.inquiries.updateMany({
        where: { id: input.id, tenant_id: input.tenantId, deleted_at: null },
        data: input.data,
      });
      if (updated.count !== 1) return false;
      await tx.inquiry_history.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: input.id,
          change_type: INQUIRY_HISTORY_TYPES.STAGE_CHANGED,
          changed_fields: input.changedFields ?? ({ from: input.fromStage, to: input.toStage } as Prisma.InputJsonObject),
          changed_by: input.actorId ?? null,
          changed_by_email: input.actorEmail ?? null,
        },
      });
      await tx.inquiry_activities.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: input.id,
          activity_type: input.activityType,
          content: `Stage changed: ${input.fromStage} → ${input.toStage}`,
          metadata: input.changedFields ?? ({ from: input.fromStage, to: input.toStage } as Prisma.InputJsonObject),
          actor_id: input.actorId ?? null,
          actor_email: input.actorEmail ?? null,
        },
      });
      return true;
    });
  }

  // --- Assignment ------------------------------------------------------------

  async assign(input: {
    tenantId: string;
    id: string;
    employeeId: string;
    previousEmployeeId: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const updated = await tx.inquiries.updateMany({
        where: { id: input.id, tenant_id: input.tenantId, deleted_at: null },
        data: { assigned_employee_id: input.employeeId, updated_by: input.actorId ?? null },
      });
      if (updated.count !== 1) return false;
      await tx.inquiry_assignments.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: input.id,
          employee_id: input.employeeId,
          assigned_by: input.actorId ?? null,
        },
      });
      await tx.inquiry_history.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: input.id,
          change_type: INQUIRY_HISTORY_TYPES.ASSIGNMENT_CHANGED,
          changed_fields: {
            from: input.previousEmployeeId,
            to: input.employeeId,
          } as Prisma.InputJsonValue,
          changed_by: input.actorId ?? null,
          changed_by_email: input.actorEmail ?? null,
        },
      });
      await tx.inquiry_activities.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: input.id,
          activity_type: INQUIRY_ACTIVITY_TYPES.INQUIRY_ASSIGNED,
          content: 'Inquiry assigned',
          metadata: { employee_id: input.employeeId } as Prisma.InputJsonValue,
          actor_id: input.actorId ?? null,
          actor_email: input.actorEmail ?? null,
        },
      });
      return true;
    });
  }

  // --- Notes -----------------------------------------------------------------

  async addNote(input: {
    tenantId: string;
    inquiryId: string;
    note: string;
    actorId?: string | null;
    actorEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const note = await tx.inquiry_notes.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: input.inquiryId,
          note: input.note,
          created_by: input.actorId ?? null,
          created_by_email: input.actorEmail ?? null,
        },
      });
      await tx.inquiry_activities.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: input.inquiryId,
          activity_type: INQUIRY_ACTIVITY_TYPES.NOTE_ADDED,
          content: input.note.slice(0, 280),
          actor_id: input.actorId ?? null,
          actor_email: input.actorEmail ?? null,
        },
      });
      return note;
    });
  }

  async listNotes(
    tenantId: string,
    inquiryId: string,
    pagination?: { skip: number; perPage: number } | null,
  ) {
    const where = { tenant_id: tenantId, inquiry_id: inquiryId };
    const orderBy = { created_at: 'desc' as const };
    if (!pagination) {
      const rows = await this.prisma.dbClient.inquiry_notes.findMany({ where, orderBy });
      return { rows, total: null as number | null };
    }
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.inquiry_notes.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.perPage,
      }),
      this.prisma.dbClient.inquiry_notes.count({ where }),
    ]);
    return { rows, total };
  }

  // --- Follow-ups ------------------------------------------------------------

  async addFollowup(input: {
    tenantId: string;
    inquiryId: string;
    data: Prisma.inquiry_followupsCreateInput;
    actorId?: string | null;
    actorEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const followup = await tx.inquiry_followups.create({ data: input.data });
      await tx.inquiry_activities.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: input.inquiryId,
          activity_type: INQUIRY_ACTIVITY_TYPES.FOLLOWUP_CREATED,
          content: `Follow-up scheduled (${followup.followup_type})`,
          metadata: {
            followup_id: followup.id,
            followup_date: followup.followup_date.toISOString(),
          } as Prisma.InputJsonValue,
          actor_id: input.actorId ?? null,
          actor_email: input.actorEmail ?? null,
        },
      });
      return followup;
    });
  }

  async listFollowups(
    tenantId: string,
    inquiryId: string,
    pagination?: { skip: number; perPage: number } | null,
  ) {
    const where = { tenant_id: tenantId, inquiry_id: inquiryId };
    const orderBy = { followup_date: 'asc' as const };
    const include = { employee: { include: employeeUserSelect } };
    if (!pagination) {
      const rows = await this.prisma.dbClient.inquiry_followups.findMany({ where, orderBy, include });
      return { rows, total: null as number | null };
    }
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.inquiry_followups.findMany({
        where,
        orderBy,
        include,
        skip: pagination.skip,
        take: pagination.perPage,
      }),
      this.prisma.dbClient.inquiry_followups.count({ where }),
    ]);
    return { rows, total };
  }

  async findFollowup(tenantId: string, inquiryId: string, followupId: string) {
    return this.prisma.dbClient.inquiry_followups.findFirst({
      where: { id: followupId, inquiry_id: inquiryId, tenant_id: tenantId },
    });
  }

  async updateFollowup(
    tenantId: string,
    inquiryId: string,
    followupId: string,
    data: Prisma.inquiry_followupsUpdateInput,
  ) {
    const result = await this.prisma.dbClient.inquiry_followups.updateMany({
      where: { id: followupId, tenant_id: tenantId, inquiry_id: inquiryId },
      data,
    });
    if (result.count !== 1) return null;
    return this.prisma.dbClient.inquiry_followups.findFirst({
      where: { id: followupId, tenant_id: tenantId, inquiry_id: inquiryId },
      include: { employee: { include: employeeUserSelect } },
    });
  }

  // --- Site visits -----------------------------------------------------------

  async addSiteVisit(input: {
    tenantId: string;
    inquiryId: string;
    data: Prisma.site_visitsCreateInput;
    actorId?: string | null;
    actorEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const visit = await tx.site_visits.create({ data: input.data });
      await tx.inquiry_activities.create({
        data: {
          tenant_id: input.tenantId,
          inquiry_id: input.inquiryId,
          activity_type: INQUIRY_ACTIVITY_TYPES.SITE_VISIT_SCHEDULED,
          content: 'Site visit scheduled',
          metadata: {
            site_visit_id: visit.id,
            scheduled_at: visit.scheduled_at.toISOString(),
          } as Prisma.InputJsonValue,
          actor_id: input.actorId ?? null,
          actor_email: input.actorEmail ?? null,
        },
      });
      return visit;
    });
  }

  async listSiteVisits(tenantId: string, inquiryId: string) {
    return this.prisma.dbClient.site_visits.findMany({
      where: { tenant_id: tenantId, inquiry_id: inquiryId },
      orderBy: { scheduled_at: 'desc' },
      include: {
        employee: { include: employeeUserSelect },
        property: { select: { id: true, property_code: true, title: true } },
      },
    });
  }

  async findSiteVisit(tenantId: string, inquiryId: string, visitId: string) {
    return this.prisma.dbClient.site_visits.findFirst({
      where: { id: visitId, inquiry_id: inquiryId, tenant_id: tenantId },
    });
  }

  async updateSiteVisit(input: {
    tenantId: string;
    inquiryId: string;
    visitId: string;
    data: Prisma.site_visitsUpdateInput;
    markCompleted: boolean;
    actorId?: string | null;
    actorEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const result = await tx.site_visits.updateMany({
        where: { id: input.visitId, tenant_id: input.tenantId, inquiry_id: input.inquiryId },
        data: input.data,
      });
      if (result.count !== 1) return null;
      const visit = await tx.site_visits.findFirst({
        where: { id: input.visitId, tenant_id: input.tenantId, inquiry_id: input.inquiryId },
        include: {
          employee: { include: employeeUserSelect },
          property: { select: { id: true, property_code: true, title: true } },
        },
      });
      if (input.markCompleted) {
        await tx.inquiry_activities.create({
          data: {
            tenant_id: input.tenantId,
            inquiry_id: input.inquiryId,
            activity_type: INQUIRY_ACTIVITY_TYPES.SITE_VISIT_COMPLETED,
            content: 'Site visit completed',
            metadata: { site_visit_id: input.visitId } as Prisma.InputJsonValue,
            actor_id: input.actorId ?? null,
            actor_email: input.actorEmail ?? null,
          },
        });
      }
      return visit;
    });
  }

  // --- Timeline (history + activities) --------------------------------------

  async listHistory(
    tenantId: string,
    inquiryId: string,
    pagination?: { skip: number; perPage: number } | null,
  ) {
    const where = { tenant_id: tenantId, inquiry_id: inquiryId };
    const orderBy = { created_at: 'desc' as const };
    if (!pagination) {
      const rows = await this.prisma.dbClient.inquiry_history.findMany({ where, orderBy });
      return { rows, total: null as number | null };
    }
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.inquiry_history.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.perPage,
      }),
      this.prisma.dbClient.inquiry_history.count({ where }),
    ]);
    return { rows, total };
  }

  async listActivities(
    tenantId: string,
    inquiryId: string,
    pagination?: { skip: number; perPage: number } | null,
  ) {
    const where = { tenant_id: tenantId, inquiry_id: inquiryId };
    const orderBy = { created_at: 'desc' as const };
    if (!pagination) {
      const rows = await this.prisma.dbClient.inquiry_activities.findMany({ where, orderBy });
      return { rows, total: null as number | null };
    }
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.inquiry_activities.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.perPage,
      }),
      this.prisma.dbClient.inquiry_activities.count({ where }),
    ]);
    return { rows, total };
  }

  async listAssignments(tenantId: string, inquiryId: string) {
    return this.prisma.dbClient.inquiry_assignments.findMany({
      where: { tenant_id: tenantId, inquiry_id: inquiryId },
      orderBy: { assigned_at: 'desc' },
      include: { employee: { include: employeeUserSelect } },
    });
  }

  // --- Lead sources ----------------------------------------------------------

  async createLeadSource(data: Prisma.lead_sourcesCreateInput) {
    return this.prisma.dbClient.lead_sources.create({ data });
  }

  async listLeadSources(
    tenantId: string,
    includeInactive: boolean,
    pagination?: { skip: number; perPage: number } | null,
  ) {
    const where = {
      tenant_id: tenantId,
      deleted_at: null,
      ...(includeInactive ? {} : { is_active: true }),
    };
    const orderBy = { name: 'asc' as const };
    if (!pagination) {
      const rows = await this.prisma.dbClient.lead_sources.findMany({ where, orderBy });
      return { rows, total: null as number | null };
    }
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.lead_sources.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.perPage,
      }),
      this.prisma.dbClient.lead_sources.count({ where }),
    ]);
    return { rows, total };
  }

  async findLeadSourceById(tenantId: string, id: string) {
    return this.prisma.dbClient.lead_sources.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
    });
  }

  async findLeadSourceByName(tenantId: string, name: string) {
    return this.prisma.dbClient.lead_sources.findFirst({
      where: { tenant_id: tenantId, name, deleted_at: null },
    });
  }

  async updateLeadSource(tenantId: string, id: string, data: Prisma.lead_sourcesUpdateInput) {
    const result = await this.prisma.dbClient.lead_sources.updateMany({
      where: { id, tenant_id: tenantId, deleted_at: null },
      data,
    });
    if (result.count !== 1) return null;
    return this.findLeadSourceById(tenantId, id);
  }

  // --- Metrics (dashboard-ready, reusable) -----------------------------------

  async stageCounts(where: Prisma.inquiriesWhereInput) {
    return this.prisma.dbClient.inquiries.groupBy({
      by: ['stage'],
      where,
      _count: { _all: true },
    });
  }

  async countInquiries(where: Prisma.inquiriesWhereInput) {
    return this.prisma.dbClient.inquiries.count({ where });
  }

  async countSiteVisits(where: Prisma.site_visitsWhereInput) {
    return this.prisma.dbClient.site_visits.count({ where });
  }

  async topPerformer(where: Prisma.inquiriesWhereInput) {
    const grouped = await this.prisma.dbClient.inquiries.groupBy({
      by: ['assigned_employee_id'],
      where: { ...where, stage: 'CLOSED_WON', assigned_employee_id: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { assigned_employee_id: 'desc' } },
      take: 1,
    });
    return grouped[0] ?? null;
  }

  async employeeName(tenantId: string, employeeId: string) {
    const emp = await this.prisma.dbClient.employees.findFirst({
      where: {
        id: employeeId,
        deleted_at: null,
        user: { tenant_id: tenantId, deleted_at: null },
      },
      include: { user: { select: { first_name: true, last_name: true, email: true } } },
    });
    if (!emp) return null;
    return (
      [emp.user?.first_name, emp.user?.last_name].filter(Boolean).join(' ') ||
      emp.user?.email ||
      null
    );
  }
}
