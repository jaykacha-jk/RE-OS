import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

import type { AuthUser } from '../../common/context/auth-user';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import {
  CRM_CONTACT_PII_ACCESS_ROLES,
  CRM_FULL_ACCESS_ROLES,
  CRM_OPERATIONAL_PII_ACCESS_ROLES,
  CRM_STAGE_JUMP_ROLES,
  CRM_TEAM_ACCESS_ROLES,
  INQUIRY_ACTIVITY_TYPES,
  INQUIRY_DUPLICATE_WINDOW_DAYS,
  INQUIRY_HISTORY_TYPES,
  INQUIRY_LOST_STAGE,
  INQUIRY_STAGE_TRANSITIONS,
  INQUIRY_TERMINAL_STAGES,
  INQUIRY_WON_STAGE,
  type InquiryStage,
} from './crm.constants';
import { CrmRepository, type InquiryScope } from './crm.repository';
import { AssignInquiryDto } from './dto/assign-inquiry.dto';
import { ChangeStageDto } from './dto/change-stage.dto';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateSiteVisitDto } from './dto/create-site-visit.dto';
import { CreateLeadSourceDto, UpdateLeadSourceDto } from './dto/lead-source.dto';
import { ListInquiriesQueryDto } from './dto/list-inquiries-query.dto';
import { PublicInquiryDto } from './dto/public-inquiry.dto';
import { UpdateFollowupDto } from './dto/update-followup.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { UpdateSiteVisitDto } from './dto/update-site-visit.dto';

type InquiryDetail = NonNullable<Awaited<ReturnType<CrmRepository['findById']>>>;
type InquiryBasic = NonNullable<Awaited<ReturnType<CrmRepository['findBasicById']>>>;

@Injectable()
export class CrmService {
  constructor(
    private readonly repo: CrmRepository,
    private readonly auditService: AuditService,
    private readonly events: DomainEventBus,
  ) {}

  // ===========================================================================
  // Phase 5 — domain event helpers (notifications & automation)
  // ===========================================================================

  /** Combine a date (YYYY-MM-DD) + optional time (HH:mm) into a Date. */
  private combineDateTime(date: Date | string, time?: string | null): Date {
    const base = typeof date === 'string' ? new Date(date) : new Date(date);
    if (time && /^\d{2}:\d{2}$/.test(time)) {
      const [h, m] = time.split(':').map(Number);
      base.setHours(h, m, 0, 0);
    }
    return base;
  }

  // ===========================================================================
  // RBAC scope
  // ===========================================================================

  async resolveScope(user: AuthUser, tenantId: string): Promise<InquiryScope> {
    if (user.roles.some((r) => CRM_FULL_ACCESS_ROLES.includes(r))) {
      return { type: 'all' };
    }
    const employee = await this.repo.findEmployeeByUserId(tenantId, user.userId);
    if (!employee) return { type: 'employees', employeeIds: [] };

    if (user.roles.some((r) => CRM_TEAM_ACCESS_ROLES.includes(r))) {
      const subordinates = await this.repo.findSubordinateEmployeeIds(tenantId, employee.id);
      return { type: 'employees', employeeIds: [employee.id, ...subordinates] };
    }
    return { type: 'employees', employeeIds: [employee.id] };
  }

  private async assertCanAccess(
    user: AuthUser,
    tenantId: string,
    inquiry: { assigned_employee_id: string | null },
  ) {
    const scope = await this.resolveScope(user, tenantId);
    if (scope.type === 'all') return;
    if (
      inquiry.assigned_employee_id &&
      scope.employeeIds.includes(inquiry.assigned_employee_id)
    ) {
      return;
    }
    // Hide existence across scope boundaries (mirror cross-tenant 404 policy).
    throw new NotFoundException('Inquiry not found');
  }

  private canJumpStages(user: AuthUser): boolean {
    return user.roles.some((r) => CRM_STAGE_JUMP_ROLES.includes(r));
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private toNum(value: Prisma.Decimal | null | undefined): number | null {
    return value == null ? null : Number(value);
  }

  private async generateInquiryCode(tenantId: string) {
    for (let i = 0; i < 25; i++) {
      const code = `INQ-${randomBytes(3).toString('hex').toUpperCase()}`;
      if (!(await this.repo.inquiryCodeExists(tenantId, code))) return code;
    }
    return `INQ-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private validateBudget(min?: number | null, max?: number | null) {
    if (min != null && max != null && max < min) {
      throw new UnprocessableEntityException({
        code: 'BUSINESS_RULE_VIOLATION',
        message: 'budget_max must be greater than or equal to budget_min',
        rule_id: 'BR-C08',
      });
    }
  }

  private validateStageTransition(from: string, to: string, canJump: boolean) {
    if (from === to) return;
    if (INQUIRY_TERMINAL_STAGES.includes(from as InquiryStage) && !canJump) {
      throw new UnprocessableEntityException({
        code: 'INVALID_STAGE_TRANSITION',
        message: `Inquiry is already closed ('${from}')`,
        rule_id: 'BR-C02',
      });
    }
    if (canJump) return;
    const allowed = INQUIRY_STAGE_TRANSITIONS[from as InquiryStage];
    if (!allowed || !allowed.includes(to as InquiryStage)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_STAGE_TRANSITION',
        message: `Cannot move inquiry from '${from}' to '${to}'`,
        rule_id: 'BR-C02',
      });
    }
  }

  private async validateLinks(
    tenantId: string,
    propertyId?: string | null,
    employeeId?: string | null,
  ) {
    if (propertyId) {
      const property = await this.repo.findPropertyById(tenantId, propertyId);
      if (!property) throw new BadRequestException('property_id is invalid for this tenant');
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

  private hasAnyRole(user: AuthUser | null | undefined, roles: readonly string[]): boolean {
    if (!user) return true;
    return user.roles.some((role) => roles.includes(role));
  }

  private canSeeContactPii(user: AuthUser | null | undefined): boolean {
    return this.hasAnyRole(user, CRM_CONTACT_PII_ACCESS_ROLES);
  }

  private canSeeOperationalPii(user: AuthUser | null | undefined): boolean {
    return this.hasAnyRole(user, CRM_OPERATIONAL_PII_ACCESS_ROLES);
  }

  // ===========================================================================
  // Mappers
  // ===========================================================================

  private mapListItem(i: InquiryBasic, user?: AuthUser | null) {
    const contactVisible = this.canSeeContactPii(user);
    const operationalVisible = this.canSeeOperationalPii(user);
    return {
      id: i.id,
      inquiry_code: i.inquiry_code,
      client_name: i.client_name,
      phone: contactVisible ? i.phone : null,
      email: operationalVisible ? i.email : null,
      whatsapp: contactVisible ? i.whatsapp : null,
      stage: i.stage,
      priority: i.priority,
      temperature: i.temperature,
      lead_score: operationalVisible ? i.lead_score : null,
      requirement_type: i.requirement_type,
      property_type: i.property_type,
      preferred_location: i.preferred_location,
      bedrooms: i.bedrooms,
      budget_min: operationalVisible ? this.toNum(i.budget_min) : null,
      budget_max: operationalVisible ? this.toNum(i.budget_max) : null,
      booking_amount: operationalVisible ? this.toNum(i.booking_amount) : null,
      expected_commission: operationalVisible ? this.toNum(i.expected_commission) : null,
      received_commission: operationalVisible ? this.toNum(i.received_commission) : null,
      commission_status: operationalVisible ? i.commission_status : null,
      purchase_timeline: i.purchase_timeline,
      source_id: i.source_id,
      source_name: i.source?.name ?? i.source_name ?? null,
      property_id: i.property_id,
      property: i.property
        ? { id: i.property.id, property_code: i.property.property_code, title: i.property.title }
        : null,
      assigned_employee_id: i.assigned_employee_id,
      assigned_employee_name: this.employeeName(i.assigned_employee),
      closed_at: i.closed_at?.toISOString() ?? null,
      created_at: i.created_at.toISOString(),
      updated_at: i.updated_at.toISOString(),
    };
  }

  private mapDetail(i: InquiryDetail, user?: AuthUser | null) {
    const operationalVisible = this.canSeeOperationalPii(user);
    return {
      ...this.mapListItem(i as unknown as InquiryBasic, user),
      remarks: operationalVisible ? i.remarks : null,
      lost_reason: operationalVisible ? i.lost_reason : null,
      no_property_reason: operationalVisible ? i.no_property_reason : null,
      created_by: operationalVisible ? i.created_by : null,
      updated_by: operationalVisible ? i.updated_by : null,
      notes: i.notes.map((n) => ({
        id: n.id,
        note: operationalVisible ? n.note : null,
        created_by: operationalVisible ? n.created_by : null,
        created_by_email: operationalVisible ? n.created_by_email : null,
        created_at: n.created_at.toISOString(),
      })),
      followups: i.followups.map((f) => this.mapFollowup(f, user)),
      site_visits: i.site_visits.map((s) => this.mapSiteVisit(s, user)),
    };
  }

  private mapFollowup(f: {
    id: string;
    followup_date: Date;
    followup_time: string | null;
    followup_type: string;
    status: string;
    notes: string | null;
    completed_at: Date | null;
    assigned_employee_id: string | null;
    created_at: Date;
    employee?: {
      user?: { first_name: string | null; last_name: string | null; email: string } | null;
    } | null;
  }, user?: AuthUser | null) {
    const operationalVisible = this.canSeeOperationalPii(user);
    return {
      id: f.id,
      followup_date: f.followup_date.toISOString().slice(0, 10),
      followup_time: f.followup_time,
      followup_type: f.followup_type,
      status: f.status,
      notes: operationalVisible ? f.notes : null,
      completed_at: f.completed_at?.toISOString() ?? null,
      assigned_employee_id: f.assigned_employee_id,
      assigned_employee_name: this.employeeName(f.employee),
      created_at: f.created_at.toISOString(),
    };
  }

  private mapSiteVisit(s: {
    id: string;
    scheduled_at: Date;
    completed_at: Date | null;
    status: string;
    notes: string | null;
    property_id: string | null;
    employee_id: string | null;
    created_at: Date;
    employee?: {
      user?: { first_name: string | null; last_name: string | null; email: string } | null;
    } | null;
    property?: { id: string; property_code: string; title: string } | null;
  }, user?: AuthUser | null) {
    const operationalVisible = this.canSeeOperationalPii(user);
    return {
      id: s.id,
      scheduled_at: s.scheduled_at.toISOString(),
      completed_at: s.completed_at?.toISOString() ?? null,
      status: s.status,
      notes: operationalVisible ? s.notes : null,
      property_id: s.property_id,
      property: s.property
        ? { id: s.property.id, property_code: s.property.property_code, title: s.property.title }
        : null,
      employee_id: s.employee_id,
      employee_name: this.employeeName(s.employee),
      created_at: s.created_at.toISOString(),
    };
  }

  // ===========================================================================
  // Inquiry CRUD
  // ===========================================================================

  async create(tenantId: string, dto: CreateInquiryDto, actor: AuthUser, meta?: AuditRequestMeta) {
    this.validateBudget(dto.budget_min, dto.budget_max);
    await this.validateLinks(tenantId, dto.property_id, dto.assigned_employee_id);

    // BR-C01: duplicate detection (same phone + open stage within window).
    if (!dto.override_duplicate) {
      const since = new Date(Date.now() - INQUIRY_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const existing = await this.repo.findRecentOpenByPhone(tenantId, dto.phone, since);
      if (existing) {
        throw new ConflictException({
          code: 'DUPLICATE_INQUIRY',
          message: `An open inquiry (${existing.inquiry_code}) with this phone exists within ${INQUIRY_DUPLICATE_WINDOW_DAYS} days. Set override_duplicate to proceed.`,
          rule_id: 'BR-C01',
          existing_inquiry_id: existing.id,
        });
      }
    }

    // Resolve source snapshot.
    let sourceName = dto.source_name ?? null;
    if (dto.source_id) {
      const source = await this.repo.findLeadSourceById(tenantId, dto.source_id);
      if (!source) throw new BadRequestException('source_id is invalid for this tenant');
      sourceName = source.name;
    }

    const inquiryCode = await this.generateInquiryCode(tenantId);

    const data: Prisma.inquiriesCreateInput = {
      tenant: { connect: { id: tenantId } },
      inquiry_code: inquiryCode,
      client_name: dto.client_name,
      phone: dto.phone,
      email: dto.email ?? null,
      whatsapp: dto.whatsapp ?? null,
      budget_min: dto.budget_min ?? null,
      budget_max: dto.budget_max ?? null,
      requirement_type: dto.requirement_type ?? null,
      preferred_location: dto.preferred_location ?? null,
      property_type: dto.property_type ?? null,
      bedrooms: dto.bedrooms ?? null,
      purchase_timeline: dto.purchase_timeline ?? null,
      priority: dto.priority ?? 'medium',
      temperature: dto.temperature ?? 'warm',
      lead_score: dto.lead_score ?? null,
      remarks: dto.remarks ?? null,
      source_name: sourceName,
      stage: 'NEW',
      created_by: actor.userId,
      updated_by: actor.userId,
      ...(dto.property_id ? { property: { connect: { id: dto.property_id } } } : {}),
      ...(dto.assigned_employee_id
        ? { assigned_employee: { connect: { id: dto.assigned_employee_id } } }
        : {}),
      ...(dto.source_id ? { source: { connect: { id: dto.source_id } } } : {}),
    };

    const id = await this.repo.createInquiry({
      tenantId,
      data,
      assignedEmployeeId: dto.assigned_employee_id ?? null,
      actorId: actor.userId,
    });

    const created = await this.repo.findById(tenantId, id);
    const mapped = this.mapDetail(created!, actor);

    await this.auditService.record({
      actor,
      tenantId,
      action: 'crm.inquiry.created',
      entityType: 'inquiry',
      entityId: id,
      afterState: { inquiry_code: mapped.inquiry_code, stage: mapped.stage },
      meta,
    });

    // Phase 5: notify org admins of the new lead; notify assignee if pre-assigned.
    this.events.emit(DOMAIN_EVENTS.INQUIRY_CREATED, {
      tenantId,
      actorUserId: actor.userId,
      entityType: 'inquiry',
      entityId: id,
      context: { inquiryCode: mapped.inquiry_code, clientName: mapped.client_name },
    });
    if (dto.assigned_employee_id) {
      this.events.emit(DOMAIN_EVENTS.LEAD_ASSIGNED, {
        tenantId,
        actorUserId: actor.userId,
        entityType: 'inquiry',
        entityId: id,
        context: {
          employeeId: dto.assigned_employee_id,
          inquiryCode: mapped.inquiry_code,
          clientName: mapped.client_name,
        },
      });
    }

    return mapped;
  }

  async createPublicInquiry(tenantSlug: string, dto: PublicInquiryDto, meta?: AuditRequestMeta) {
    const org = await this.repo.findOrganizationBySlug(tenantSlug);
    if (!org || org.status === 'suspended') throw new NotFoundException('Tenant not found');

    this.validateBudget(dto.budget_min, dto.budget_max);

    const property = dto.property_slug
      ? await this.repo.findPublicPropertyBySlug(org.id, dto.property_slug)
      : null;
    if (dto.property_slug && !property) throw new NotFoundException('Listing not found');

    const since = new Date(Date.now() - INQUIRY_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const existing = await this.repo.findRecentOpenByPhone(org.id, dto.phone, since);
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_INQUIRY',
        message: `An open inquiry (${existing.inquiry_code}) with this phone exists within ${INQUIRY_DUPLICATE_WINDOW_DAYS} days.`,
        rule_id: 'BR-C01',
        existing_inquiry_id: existing.id,
      });
    }

    const inquiryCode = await this.generateInquiryCode(org.id);
    const data: Prisma.inquiriesCreateInput = {
      tenant: { connect: { id: org.id } },
      inquiry_code: inquiryCode,
      client_name: dto.client_name,
      phone: dto.phone,
      email: dto.email ?? null,
      whatsapp: dto.whatsapp ?? null,
      budget_min: dto.budget_min ?? null,
      budget_max: dto.budget_max ?? null,
      requirement_type: dto.requirement_type ?? property?.requirement_type ?? null,
      preferred_location: dto.preferred_location ?? property?.city ?? null,
      property_type: property?.category ?? null,
      bedrooms: property?.bedrooms ?? null,
      purchase_timeline: null,
      priority: 'medium',
      temperature: 'warm',
      lead_score: null,
      remarks: dto.message ?? null,
      source_name: 'Website',
      stage: 'NEW',
      created_by: null,
      updated_by: null,
      ...(property ? { property: { connect: { id: property.id } } } : {}),
    };

    const id = await this.repo.createInquiry({
      tenantId: org.id,
      data,
      actorId: null,
      actorEmail: null,
    });
    const created = await this.repo.findById(org.id, id);
    const mapped = this.mapDetail(created!, null);

    await this.auditService.record({
      actor: null,
      tenantId: org.id,
      action: 'crm.public_inquiry.created',
      entityType: 'inquiry',
      entityId: id,
      afterState: { inquiry_code: mapped.inquiry_code, source_name: 'Website' },
      meta,
    });

    this.events.emit(DOMAIN_EVENTS.INQUIRY_CREATED, {
      tenantId: org.id,
      actorUserId: null,
      entityType: 'inquiry',
      entityId: id,
      context: {
        inquiryCode: mapped.inquiry_code,
        clientName: mapped.client_name,
        source: 'Website',
        propertySlug: property?.slug ?? null,
      },
    });

    return {
      inquiry_id: mapped.id,
      inquiry_code: mapped.inquiry_code,
      message: 'We will contact you shortly',
    };
  }

  async list(tenantId: string, user: AuthUser, query: ListInquiriesQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const scope = await this.resolveScope(user, tenantId);

    const where = this.repo.buildWhere(
      tenantId,
      {
        search: query.search,
        stage: query['filter[stage]'],
        priority: query['filter[priority]'],
        temperature: query['filter[temperature]'],
        sourceId: query['filter[source]'],
        assignedEmployee: query['filter[assigned_employee]'],
        propertyId: query['filter[property]'],
        dateFrom: query['filter[date_from]'],
        dateTo: query['filter[date_to]'],
      },
      scope,
    );

    const { rows, total } = await this.repo.list({
      where,
      sortBy: query.sort_by ?? 'created_at',
      sortDir: query.sort_dir ?? 'desc',
      page,
      perPage,
    });

    return {
      data: rows.map((row) => this.mapListItem(row as InquiryBasic, user)),
      meta: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) || 1 },
    };
  }

  async getSummary(tenantId: string, user: AuthUser, query: ListInquiriesQueryDto) {
    const scope = await this.resolveScope(user, tenantId);
    const where = this.repo.buildWhere(
      tenantId,
      {
        search: query.search,
        stage: query['filter[stage]'],
        priority: query['filter[priority]'],
        temperature: query['filter[temperature]'],
        sourceId: query['filter[source]'],
        assignedEmployee: query['filter[assigned_employee]'],
        propertyId: query['filter[property]'],
        dateFrom: query['filter[date_from]'],
        dateTo: query['filter[date_to]'],
      },
      scope,
    );
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const createdAt = typeof where.created_at === 'object' && where.created_at !== null ? where.created_at : {};

    const [stageCounts, total, hot, unassigned, staleNew] = await Promise.all([
      this.repo.stageCounts(where),
      this.repo.countInquiries(where),
      this.repo.countInquiries({ ...where, temperature: 'hot' }),
      this.repo.countInquiries({ ...where, assigned_employee_id: null }),
      this.repo.countInquiries({
        ...where,
        stage: 'NEW',
        created_at: { ...createdAt, lte: staleCutoff },
      }),
    ]);

    const byStage: Record<string, number> = {};
    for (const row of stageCounts) byStage[row.stage] = row._count._all;
    const qualified =
      (byStage.QUALIFIED ?? 0) +
      (byStage.SITE_VISIT_SCHEDULED ?? 0) +
      (byStage.SITE_VISIT_COMPLETED ?? 0) +
      (byStage.NEGOTIATION ?? 0);

    return {
      total,
      hot,
      unassigned,
      stale_new: staleNew,
      qualified,
      booked: byStage.BOOKED ?? 0,
      won: byStage.CLOSED_WON ?? 0,
      lost: byStage.CLOSED_LOST ?? 0,
      by_stage: byStage,
    };
  }

  async getOne(tenantId: string, user: AuthUser, id: string) {
    const inquiry = await this.repo.findById(tenantId, id);
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    await this.assertCanAccess(user, tenantId, inquiry);
    return this.mapDetail(inquiry, user);
  }

  async update(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: UpdateInquiryDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Inquiry not found');
    await this.assertCanAccess(user, tenantId, existing);

    const nextMin = dto.budget_min !== undefined ? dto.budget_min : this.toNum(existing.budget_min);
    const nextMax = dto.budget_max !== undefined ? dto.budget_max : this.toNum(existing.budget_max);
    this.validateBudget(nextMin, nextMax);

    await this.validateLinks(tenantId, dto.property_id, undefined);

    const data: Prisma.inquiriesUpdateInput = { updated_by: user.userId };
    const changedFields: Record<string, { from: unknown; to: unknown }> = {};

    const setScalar = <K extends keyof UpdateInquiryDto>(key: K, column: string) => {
      if (dto[key] === undefined) return;
      const value = dto[key];
      (data as Record<string, unknown>)[column] = value ?? null;
      changedFields[column] = { from: (existing as Record<string, unknown>)[column] ?? null, to: value ?? null };
    };

    setScalar('client_name', 'client_name');
    setScalar('phone', 'phone');
    setScalar('email', 'email');
    setScalar('whatsapp', 'whatsapp');
    setScalar('requirement_type', 'requirement_type');
    setScalar('preferred_location', 'preferred_location');
    setScalar('property_type', 'property_type');
    setScalar('bedrooms', 'bedrooms');
    setScalar('purchase_timeline', 'purchase_timeline');
    setScalar('priority', 'priority');
    setScalar('temperature', 'temperature');
    setScalar('lead_score', 'lead_score');
    setScalar('remarks', 'remarks');

    if (dto.budget_min !== undefined) {
      data.budget_min = dto.budget_min ?? null;
      changedFields.budget_min = { from: this.toNum(existing.budget_min), to: dto.budget_min ?? null };
    }
    if (dto.budget_max !== undefined) {
      data.budget_max = dto.budget_max ?? null;
      changedFields.budget_max = { from: this.toNum(existing.budget_max), to: dto.budget_max ?? null };
    }
    if (dto.booking_amount !== undefined) {
      data.booking_amount = dto.booking_amount ?? null;
      changedFields.booking_amount = {
        from: this.toNum(existing.booking_amount),
        to: dto.booking_amount ?? null,
      };
    }
    if (dto.expected_commission !== undefined) {
      data.expected_commission = dto.expected_commission ?? null;
      changedFields.expected_commission = {
        from: this.toNum(existing.expected_commission),
        to: dto.expected_commission ?? null,
      };
    }
    if (dto.received_commission !== undefined) {
      data.received_commission = dto.received_commission ?? null;
      changedFields.received_commission = {
        from: this.toNum(existing.received_commission),
        to: dto.received_commission ?? null,
      };
    }
    if (dto.commission_status !== undefined) {
      data.commission_status = dto.commission_status ?? null;
      changedFields.commission_status = {
        from: existing.commission_status,
        to: dto.commission_status ?? null,
      };
    }

    if (dto.property_id !== undefined) {
      data.property = dto.property_id ? { connect: { id: dto.property_id } } : { disconnect: true };
      changedFields.property_id = { from: existing.property_id, to: dto.property_id ?? null };
    }

    if (dto.source_id !== undefined || dto.source_name !== undefined) {
      if (dto.source_id) {
        const source = await this.repo.findLeadSourceById(tenantId, dto.source_id);
        if (!source) throw new BadRequestException('source_id is invalid for this tenant');
        data.source = { connect: { id: dto.source_id } };
        data.source_name = source.name;
        changedFields.source_id = { from: existing.source_id, to: dto.source_id };
      } else if (dto.source_id === undefined && dto.source_name !== undefined) {
        data.source_name = dto.source_name ?? null;
        changedFields.source_name = { from: existing.source_name, to: dto.source_name ?? null };
      }
    }

    const historyEntries = Object.keys(changedFields).length
      ? [
          {
            change_type: INQUIRY_HISTORY_TYPES.INQUIRY_UPDATED,
            changed_fields: changedFields as Prisma.InputJsonValue,
            changed_by: user.userId,
          },
        ]
      : [];

    await this.repo.updateInquiry({ tenantId, id, data, historyEntries });

    const updated = await this.repo.findById(tenantId, id);
    const mapped = this.mapDetail(updated!, user);

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.inquiry.updated',
      entityType: 'inquiry',
      entityId: id,
      afterState: { fields: Object.keys(changedFields) },
      meta,
    });

    return mapped;
  }

  async remove(tenantId: string, user: AuthUser, id: string, meta?: AuditRequestMeta) {
    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Inquiry not found');
    await this.assertCanAccess(user, tenantId, existing);

    const deleted = await this.repo.softDelete(tenantId, id);
    if (!deleted) throw new NotFoundException('Inquiry not found');

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.inquiry.deleted',
      entityType: 'inquiry',
      entityId: id,
      beforeState: { inquiry_code: existing.inquiry_code, stage: existing.stage },
      meta,
    });

    return { id, deleted: true };
  }

  // ===========================================================================
  // Stage workflow (BR-C02 / BR-C03 / BR-C04)
  // ===========================================================================

  async changeStage(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: ChangeStageDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Inquiry not found');
    await this.assertCanAccess(user, tenantId, existing);

    const from = existing.stage;
    const to = dto.stage;

    if (from === to) return this.mapDetail(existing, user);

    this.validateStageTransition(from, to, this.canJumpStages(user));

    const data: Prisma.inquiriesUpdateInput = { stage: to, updated_by: user.userId };
    let activityType: string = INQUIRY_ACTIVITY_TYPES.STAGE_CHANGED;
    const stageChangedFields: Record<string, unknown> = { from, to };

    if (dto.booking_amount !== undefined) {
      data.booking_amount = dto.booking_amount ?? null;
      stageChangedFields.booking_amount = {
        from: this.toNum(existing.booking_amount),
        to: dto.booking_amount ?? null,
      };
    }
    if (dto.expected_commission !== undefined) {
      data.expected_commission = dto.expected_commission ?? null;
      stageChangedFields.expected_commission = {
        from: this.toNum(existing.expected_commission),
        to: dto.expected_commission ?? null,
      };
    }
    if (dto.received_commission !== undefined) {
      data.received_commission = dto.received_commission ?? null;
      stageChangedFields.received_commission = {
        from: this.toNum(existing.received_commission),
        to: dto.received_commission ?? null,
      };
    }
    if (dto.commission_status !== undefined) {
      data.commission_status = dto.commission_status ?? null;
      stageChangedFields.commission_status = {
        from: existing.commission_status,
        to: dto.commission_status ?? null,
      };
    }

    if (to === INQUIRY_WON_STAGE) {
      // BR-C03: requires linked property or explicit reason.
      if (!existing.property_id && !dto.no_property_reason) {
        throw new UnprocessableEntityException({
          code: 'BUSINESS_RULE_VIOLATION',
          message: 'Closed Won requires a linked property or a no_property_reason',
          rule_id: 'BR-C03',
        });
      }
      data.no_property_reason = dto.no_property_reason ?? null;
      data.closed_at = new Date();
      activityType = INQUIRY_ACTIVITY_TYPES.CLOSED_WON;
    }

    if (to === INQUIRY_LOST_STAGE) {
      // BR-C04: requires lost_reason.
      if (!dto.lost_reason) {
        throw new UnprocessableEntityException({
          code: 'BUSINESS_RULE_VIOLATION',
          message: 'Closed Lost requires a lost_reason',
          rule_id: 'BR-C04',
        });
      }
      data.lost_reason = dto.lost_reason;
      data.closed_at = new Date();
      activityType = INQUIRY_ACTIVITY_TYPES.CLOSED_LOST;
    }

    await this.repo.changeStage({
      tenantId,
      id,
      data,
      fromStage: from,
      toStage: to,
      activityType,
      changedFields: stageChangedFields as Prisma.InputJsonObject,
      actorId: user.userId,
    });

    const updated = await this.repo.findById(tenantId, id);

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.inquiry.stage_changed',
      entityType: 'inquiry',
      entityId: id,
      beforeState: { stage: from },
      afterState: { stage: to },
      meta,
    });

    return this.mapDetail(updated!, user);
  }

  // ===========================================================================
  // Assignment (BR-C05: notification deferred to Phase 5)
  // ===========================================================================

  async assign(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: AssignInquiryDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Inquiry not found');
    await this.assertCanAccess(user, tenantId, existing);

    const employee = await this.repo.findEmployeeById(tenantId, dto.employee_id);
    if (!employee) throw new BadRequestException('employee_id is invalid for this tenant');

    await this.repo.assign({
      tenantId,
      id,
      employeeId: dto.employee_id,
      previousEmployeeId: existing.assigned_employee_id,
      actorId: user.userId,
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.inquiry.assigned',
      entityType: 'inquiry',
      entityId: id,
      beforeState: { assigned_employee_id: existing.assigned_employee_id },
      afterState: { assigned_employee_id: dto.employee_id },
      meta,
    });

    // Phase 5: notify the newly assigned employee.
    this.events.emit(DOMAIN_EVENTS.LEAD_ASSIGNED, {
      tenantId,
      actorUserId: user.userId,
      entityType: 'inquiry',
      entityId: id,
      context: {
        employeeId: dto.employee_id,
        inquiryCode: existing.inquiry_code,
        clientName: existing.client_name,
      },
    });

    const updated = await this.repo.findById(tenantId, id);
    return this.mapDetail(updated!, user);
  }

  // ===========================================================================
  // Notes
  // ===========================================================================

  private async getAccessibleInquiry(tenantId: string, user: AuthUser, id: string) {
    const inquiry = await this.repo.findBasicById(tenantId, id);
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    await this.assertCanAccess(user, tenantId, inquiry);
    return inquiry;
  }

  async addNote(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: CreateNoteDto,
    meta?: AuditRequestMeta,
  ) {
    await this.getAccessibleInquiry(tenantId, user, id);
    const note = await this.repo.addNote({
      tenantId,
      inquiryId: id,
      note: dto.note,
      actorId: user.userId,
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.inquiry.note_added',
      entityType: 'inquiry',
      entityId: id,
      afterState: { note_id: note.id },
      meta,
    });

    return {
      id: note.id,
      note: note.note,
      created_by: note.created_by,
      created_by_email: note.created_by_email,
      created_at: note.created_at.toISOString(),
    };
  }

  /**
   * Phase 10 — apply AI qualification insights to an inquiry. AI *enhances* the
   * CRM: it updates lead_score + temperature, records a note, and writes a
   * history entry. `actor` may be null for system/automated (post-call) writes.
   * Scoped by tenant; never trusts a client-supplied tenant id.
   */
  async applyAiQualification(
    tenantId: string,
    inquiryId: string,
    input: {
      leadScore: number;
      temperature: string;
      summary: string;
      extracted?: Record<string, unknown>;
    },
    actor: AuthUser | null,
    meta?: AuditRequestMeta,
  ) {
    const inquiry = await this.repo.findBasicById(tenantId, inquiryId);
    if (!inquiry) throw new NotFoundException('Inquiry not found');

    await this.repo.updateInquiry({
      tenantId,
      id: inquiryId,
      data: {
        lead_score: input.leadScore,
        temperature: input.temperature,
        updated_by: actor?.userId ?? null,
      },
      historyEntries: [
        {
          change_type: INQUIRY_HISTORY_TYPES.INQUIRY_UPDATED,
          changed_fields: {
            lead_score: input.leadScore,
            temperature: input.temperature,
            source: 'ai',
          } as Prisma.InputJsonValue,
          changed_by: actor?.userId ?? null,
          changed_by_email: actor ? null : 'ai-agent',
        },
      ],
    });

    await this.repo.addNote({
      tenantId,
      inquiryId,
      note: input.summary,
      actorId: actor?.userId ?? null,
      actorEmail: actor ? null : 'ai-agent',
    });

    await this.auditService.record({
      actor: actor ?? undefined,
      actorEmail: actor ? undefined : 'ai-agent',
      tenantId,
      action: 'crm.inquiry.ai_qualified',
      entityType: 'inquiry',
      entityId: inquiryId,
      afterState: { lead_score: input.leadScore, temperature: input.temperature },
      meta,
    });

    return { id: inquiryId, lead_score: input.leadScore, temperature: input.temperature };
  }

  async listNotes(tenantId: string, user: AuthUser, id: string) {
    await this.getAccessibleInquiry(tenantId, user, id);
    const rows = await this.repo.listNotes(tenantId, id);
    const operationalVisible = this.canSeeOperationalPii(user);
    return rows.map((n) => ({
      id: n.id,
      note: operationalVisible ? n.note : null,
      created_by: operationalVisible ? n.created_by : null,
      created_by_email: operationalVisible ? n.created_by_email : null,
      created_at: n.created_at.toISOString(),
    }));
  }

  // ===========================================================================
  // Follow-ups
  // ===========================================================================

  async addFollowup(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: CreateFollowupDto,
    meta?: AuditRequestMeta,
  ) {
    const inquiry = await this.getAccessibleInquiry(tenantId, user, id);
    if (dto.assigned_employee_id) {
      await this.validateLinks(tenantId, undefined, dto.assigned_employee_id);
    }
    const employeeId = dto.assigned_employee_id ?? inquiry.assigned_employee_id ?? null;

    const data: Prisma.inquiry_followupsCreateInput = {
      tenant_id: tenantId,
      inquiry: { connect: { id } },
      followup_date: new Date(dto.followup_date),
      followup_time: dto.followup_time ?? null,
      followup_type: dto.followup_type,
      status: 'pending',
      notes: dto.notes ?? null,
      created_by: user.userId,
      ...(employeeId ? { employee: { connect: { id: employeeId } } } : {}),
    };

    const followup = await this.repo.addFollowup({
      tenantId,
      inquiryId: id,
      data,
      actorId: user.userId,
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.inquiry.followup_created',
      entityType: 'inquiry',
      entityId: id,
      afterState: { followup_id: followup.id },
      meta,
    });

    // Phase 5: schedule a "follow-up due" reminder ~1h before the due time.
    if (employeeId) {
      const when = this.combineDateTime(dto.followup_date, dto.followup_time);
      const delayMs = Math.max(when.getTime() - Date.now() - 60 * 60 * 1000, 0);
      this.events.emit(DOMAIN_EVENTS.FOLLOWUP_DUE, {
        tenantId,
        actorUserId: user.userId,
        entityType: 'inquiry',
        entityId: id,
        delayMs,
        context: {
          employeeId,
          inquiryCode: inquiry.inquiry_code,
          clientName: inquiry.client_name,
          followupType: dto.followup_type,
        },
      });
    }

    const full = await this.repo.findFollowup(tenantId, id, followup.id);
    return this.mapFollowup({ ...followup, employee: null, ...(full ?? {}) }, user);
  }

  async listFollowups(tenantId: string, user: AuthUser, id: string) {
    await this.getAccessibleInquiry(tenantId, user, id);
    const rows = await this.repo.listFollowups(tenantId, id);
    return rows.map((f) => this.mapFollowup(f, user));
  }

  async updateFollowup(
    tenantId: string,
    user: AuthUser,
    id: string,
    followupId: string,
    dto: UpdateFollowupDto,
    meta?: AuditRequestMeta,
  ) {
    await this.getAccessibleInquiry(tenantId, user, id);
    const existing = await this.repo.findFollowup(tenantId, id, followupId);
    if (!existing) throw new NotFoundException('Follow-up not found');

    const data: Prisma.inquiry_followupsUpdateInput = {};
    if (dto.followup_date !== undefined) data.followup_date = new Date(dto.followup_date);
    if (dto.followup_time !== undefined) data.followup_time = dto.followup_time ?? null;
    if (dto.followup_type !== undefined) data.followup_type = dto.followup_type;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.completed_at = dto.status === 'completed' ? new Date() : null;
    }

    const updated = await this.repo.updateFollowup(tenantId, id, followupId, data);
    if (!updated) throw new NotFoundException('Follow-up not found');

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.inquiry.followup_updated',
      entityType: 'inquiry',
      entityId: id,
      afterState: { followup_id: followupId, status: updated.status },
      meta,
    });

    // Phase 5: alert assignee + manager when a follow-up is marked missed.
    if (dto.status === 'missed' && existing.status !== 'missed') {
      const employeeId = existing.assigned_employee_id ?? null;
      if (employeeId) {
        this.events.emit(DOMAIN_EVENTS.FOLLOWUP_MISSED, {
          tenantId,
          actorUserId: user.userId,
          entityType: 'inquiry',
          entityId: id,
          context: { employeeId },
        });
      }
    }

    return this.mapFollowup(updated, user);
  }

  // ===========================================================================
  // Site visits
  // ===========================================================================

  async addSiteVisit(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: CreateSiteVisitDto,
    meta?: AuditRequestMeta,
  ) {
    const inquiry = await this.getAccessibleInquiry(tenantId, user, id);
    const propertyId = dto.property_id ?? inquiry.property_id ?? null;
    const employeeId = dto.employee_id ?? inquiry.assigned_employee_id ?? null;
    await this.validateLinks(tenantId, propertyId, employeeId);

    const data: Prisma.site_visitsCreateInput = {
      tenant_id: tenantId,
      inquiry: { connect: { id } },
      scheduled_at: new Date(dto.scheduled_at),
      status: 'scheduled',
      notes: dto.notes ?? null,
      created_by: user.userId,
      ...(propertyId ? { property: { connect: { id: propertyId } } } : {}),
      ...(employeeId ? { employee: { connect: { id: employeeId } } } : {}),
    };

    const visit = await this.repo.addSiteVisit({
      tenantId,
      inquiryId: id,
      data,
      actorId: user.userId,
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.inquiry.site_visit_scheduled',
      entityType: 'inquiry',
      entityId: id,
      afterState: { site_visit_id: visit.id },
      meta,
    });

    // Phase 5: notify assignee now + schedule a reminder ~1 day before the visit.
    if (employeeId) {
      const scheduledAt = new Date(dto.scheduled_at);
      const ctx = {
        employeeId,
        inquiryCode: inquiry.inquiry_code,
        clientName: inquiry.client_name,
        scheduledAt: scheduledAt.toISOString(),
      };
      this.events.emit(DOMAIN_EVENTS.SITE_VISIT_SCHEDULED, {
        tenantId,
        actorUserId: user.userId,
        entityType: 'inquiry',
        entityId: id,
        context: ctx,
      });
      const delayMs = Math.max(
        scheduledAt.getTime() - Date.now() - 24 * 60 * 60 * 1000,
        0,
      );
      this.events.emit(DOMAIN_EVENTS.SITE_VISIT_REMINDER, {
        tenantId,
        actorUserId: user.userId,
        entityType: 'inquiry',
        entityId: id,
        delayMs,
        context: ctx,
      });
    }

    const full = await this.repo.findSiteVisit(tenantId, id, visit.id);
    return this.mapSiteVisit({ ...visit, employee: null, property: null, ...(full ?? {}) }, user);
  }

  async listSiteVisits(tenantId: string, user: AuthUser, id: string) {
    await this.getAccessibleInquiry(tenantId, user, id);
    const rows = await this.repo.listSiteVisits(tenantId, id);
    return rows.map((s) => this.mapSiteVisit(s, user));
  }

  async updateSiteVisit(
    tenantId: string,
    user: AuthUser,
    id: string,
    visitId: string,
    dto: UpdateSiteVisitDto,
    meta?: AuditRequestMeta,
  ) {
    await this.getAccessibleInquiry(tenantId, user, id);
    const existing = await this.repo.findSiteVisit(tenantId, id, visitId);
    if (!existing) throw new NotFoundException('Site visit not found');
    await this.validateLinks(tenantId, dto.property_id, dto.employee_id);

    const data: Prisma.site_visitsUpdateInput = {};
    if (dto.scheduled_at !== undefined) data.scheduled_at = new Date(dto.scheduled_at);
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;
    if (dto.property_id !== undefined) {
      data.property = dto.property_id ? { connect: { id: dto.property_id } } : { disconnect: true };
    }
    if (dto.employee_id !== undefined) {
      data.employee = dto.employee_id ? { connect: { id: dto.employee_id } } : { disconnect: true };
    }

    const willComplete = dto.status === 'completed' && existing.status !== 'completed';
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.completed_at = dto.status === 'completed' ? new Date() : existing.completed_at;
    }

    const updated = await this.repo.updateSiteVisit({
      tenantId,
      inquiryId: id,
      visitId,
      data,
      markCompleted: willComplete,
      actorId: user.userId,
    });
    if (!updated) throw new NotFoundException('Site visit not found');

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.inquiry.site_visit_updated',
      entityType: 'inquiry',
      entityId: id,
      afterState: { site_visit_id: visitId, status: updated.status },
      meta,
    });

    return this.mapSiteVisit(updated, user);
  }

  // ===========================================================================
  // Timeline / history
  // ===========================================================================

  async getHistory(tenantId: string, user: AuthUser, id: string) {
    await this.getAccessibleInquiry(tenantId, user, id);
    const [history, activities] = await Promise.all([
      this.repo.listHistory(tenantId, id),
      this.repo.listActivities(tenantId, id),
    ]);
    return {
      history: history.map((h) => ({
        id: h.id,
        change_type: h.change_type,
        changed_fields: h.changed_fields,
        changed_by: h.changed_by,
        changed_by_email: h.changed_by_email,
        created_at: h.created_at.toISOString(),
      })),
      activities: activities.map((a) => ({
        id: a.id,
        activity_type: a.activity_type,
        content: a.content,
        metadata: a.metadata,
        actor_id: a.actor_id,
        actor_email: a.actor_email,
        created_at: a.created_at.toISOString(),
      })),
    };
  }

  // ===========================================================================
  // Lead sources
  // ===========================================================================

  async listLeadSources(tenantId: string, includeInactive = false) {
    const rows = await this.repo.listLeadSources(tenantId, includeInactive);
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      is_active: s.is_active,
      is_system: s.is_system,
      created_at: s.created_at.toISOString(),
    }));
  }

  async createLeadSource(
    tenantId: string,
    user: AuthUser,
    dto: CreateLeadSourceDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findLeadSourceByName(tenantId, dto.name);
    if (existing) throw new ConflictException('A lead source with this name already exists');

    const source = await this.repo.createLeadSource({
      tenant: { connect: { id: tenantId } },
      name: dto.name,
      code: dto.code ?? null,
      is_active: dto.is_active ?? true,
      created_by: user.userId,
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.lead_source.created',
      entityType: 'lead_source',
      entityId: source.id,
      afterState: { name: source.name },
      meta,
    });

    return {
      id: source.id,
      name: source.name,
      code: source.code,
      is_active: source.is_active,
      is_system: source.is_system,
      created_at: source.created_at.toISOString(),
    };
  }

  async updateLeadSource(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: UpdateLeadSourceDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findLeadSourceById(tenantId, id);
    if (!existing) throw new NotFoundException('Lead source not found');

    const data: Prisma.lead_sourcesUpdateInput = {};
    if (dto.name !== undefined && dto.name !== existing.name) {
      const clash = await this.repo.findLeadSourceByName(tenantId, dto.name);
      if (clash) throw new ConflictException('A lead source with this name already exists');
      data.name = dto.name;
    }
    if (dto.code !== undefined) data.code = dto.code ?? null;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    const updated = await this.repo.updateLeadSource(tenantId, id, data);
    if (!updated) throw new NotFoundException('Lead source not found');

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'crm.lead_source.updated',
      entityType: 'lead_source',
      entityId: id,
      meta,
    });

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      is_active: updated.is_active,
      is_system: updated.is_system,
      created_at: updated.created_at.toISOString(),
    };
  }

  // ===========================================================================
  // Metrics (dashboard-ready service methods — Phase 4 will consume these)
  // ===========================================================================

  async getMetrics(
    tenantId: string,
    user: AuthUser,
    range?: { from?: string; to?: string },
  ) {
    const scope = await this.resolveScope(user, tenantId);
    const baseWhere = this.repo.buildWhere(
      tenantId,
      { dateFrom: range?.from, dateTo: range?.to },
      scope,
    );

    const [stageCounts, totalLeads, performer] = await Promise.all([
      this.repo.stageCounts(baseWhere),
      this.repo.countInquiries(baseWhere),
      this.repo.topPerformer(baseWhere),
    ]);

    const byStage: Record<string, number> = {};
    for (const row of stageCounts) byStage[row.stage] = row._count._all;

    const qualifiedLeads =
      (byStage.QUALIFIED ?? 0) +
      (byStage.SITE_VISIT_SCHEDULED ?? 0) +
      (byStage.SITE_VISIT_COMPLETED ?? 0) +
      (byStage.NEGOTIATION ?? 0) +
      (byStage.BOOKED ?? 0) +
      (byStage.CLOSED_WON ?? 0);
    const wonDeals = byStage.CLOSED_WON ?? 0;
    const lostDeals = byStage.CLOSED_LOST ?? 0;

    const siteVisitWhere: Prisma.site_visitsWhereInput = {
      tenant_id: tenantId,
      ...(scope.type === 'employees'
        ? { employee_id: scope.employeeIds.length ? { in: scope.employeeIds } : '00000000-0000-0000-0000-000000000000' }
        : {}),
      ...(range?.from || range?.to
        ? {
            scheduled_at: {
              ...(range?.from ? { gte: new Date(range.from) } : {}),
              ...(range?.to ? { lte: new Date(range.to) } : {}),
            },
          }
        : {}),
    };
    const siteVisits = await this.repo.countSiteVisits(siteVisitWhere);

    let topPerformer: { employee_id: string; name: string | null; won: number } | null = null;
    if (performer?.assigned_employee_id) {
      topPerformer = {
        employee_id: performer.assigned_employee_id,
        name: await this.repo.employeeName(tenantId, performer.assigned_employee_id),
        won: performer._count._all,
      };
    }

    return {
      total_leads: totalLeads,
      qualified_leads: qualifiedLeads,
      site_visits: siteVisits,
      won_deals: wonDeals,
      lost_deals: lostDeals,
      conversion_rate: totalLeads ? Number(((wonDeals / totalLeads) * 100).toFixed(2)) : 0,
      by_stage: byStage,
      top_performer: topPerformer,
    };
  }
}
