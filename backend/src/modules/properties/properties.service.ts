import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

import type { AuthUser } from '../../common/context/auth-user';
import { paginationMeta, resolvePagination } from '../../common/pagination';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import { QuotaService } from '../billing/quota.service';
import { AssignPropertyDto } from './dto/assign-property.dto';
import { BulkImportPropertiesDto } from './dto/bulk-import-properties.dto';
import { GeocodeQueryDto } from './dto/geocode-query.dto';
import { NearbyPlacesQueryDto } from './dto/nearby-places-query.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import { AddDocumentDto, AddImageDto, AddVideoDto, ReorderImagesDto } from './dto/media.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import {
  ALLOWED_PROPERTY_IMAGE_CONTENT_TYPES,
  ALLOWED_PROPERTY_VIDEO_CONTENT_TYPES,
  PROPERTY_FULL_ACCESS_ROLES,
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_STATUSES,
  PROPERTY_STATUS_TRANSITIONS,
  PROPERTY_TEAM_ACCESS_ROLES,
  PROPERTY_VIDEO_MAX_BYTES,
  type PropertyStatus,
} from './properties.constants';
import { PropertiesRepository, type PropertyScope } from './properties.repository';
import {
  mapCsvRecordToCreateDto,
  parsePropertyCsv,
  type PropertyCsvImportResult,
} from './property-csv-import';
import { fetchNearbyPlaces, geocodeAddress } from './property-geospatial';
import { StorageService } from './storage/storage.service';

type WithRelations = NonNullable<Awaited<ReturnType<PropertiesRepository['findById']>>>;

@Injectable()
export class PropertiesService {
  constructor(
    private readonly repo: PropertiesRepository,
    private readonly storage: StorageService,
    private readonly auditService: AuditService,
    private readonly events: DomainEventBus,
    private readonly quota: QuotaService,
  ) {}

  // ===========================================================================
  // RBAC scope
  // ===========================================================================

  /**
   * Resolves the data-scope for the authenticated user:
   *  - full-access roles (owner/admin/super) => every tenant property
   *  - sales_manager => own + direct reports (team properties)
   *  - everyone else (sales_executive, telecaller) => assigned-only
   */
  async resolveScope(user: AuthUser, tenantId: string): Promise<PropertyScope> {
    if (user.roles.some((r) => PROPERTY_FULL_ACCESS_ROLES.includes(r))) {
      return { type: 'all' };
    }
    const employee = await this.repo.findEmployeeByUserId(tenantId, user.userId);
    if (!employee) return { type: 'employees', employeeIds: [] };

    if (user.roles.some((r) => PROPERTY_TEAM_ACCESS_ROLES.includes(r))) {
      const subordinates = await this.repo.findSubordinateEmployeeIds(tenantId, employee.id);
      return { type: 'employees', employeeIds: [employee.id, ...subordinates] };
    }
    return { type: 'employees', employeeIds: [employee.id] };
  }

  private async assertCanAccess(user: AuthUser, tenantId: string, property: WithRelations) {
    const scope = await this.resolveScope(user, tenantId);
    if (scope.type === 'all') return;
    const allowed = property.assignments.some((a) => scope.employeeIds.includes(a.employee_id));
    if (!allowed) {
      // Hide existence across scope boundaries (mirror cross-tenant 404 policy).
      throw new NotFoundException('Property not found');
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }

  private async generateUniqueSlug(tenantId: string, base: string, excludeId?: string) {
    const root = this.slugify(base) || 'property';
    let candidate = root;
    let attempt = 1;
    while (await this.repo.slugExists(tenantId, candidate, excludeId)) {
      attempt += 1;
      candidate = `${root}-${attempt}`;
      if (attempt > 50) {
        candidate = `${root}-${randomBytes(3).toString('hex')}`;
        break;
      }
    }
    return candidate;
  }

  private async generatePropertyCode(tenantId: string) {
    for (let i = 0; i < 25; i++) {
      const code = `PROP-${randomBytes(3).toString('hex').toUpperCase()}`;
      if (!(await this.repo.propertyCodeExists(tenantId, code))) return code;
    }
    return `PROP-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private toNum(value: Prisma.Decimal | null | undefined): number | null {
    return value == null ? null : Number(value);
  }

  private validateStatusTransition(from: string, to: string) {
    if (from === to) return;
    const allowed = PROPERTY_STATUS_TRANSITIONS[from as PropertyStatus];
    if (!allowed || !allowed.includes(to as PropertyStatus)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot transition property from '${from}' to '${to}'`,
        rule_id: 'BR-P-STATUS',
      });
    }
  }

  // ===========================================================================
  // Mappers
  // ===========================================================================

  private mapProperty(p: WithRelations) {
    return {
      id: p.id,
      property_code: p.property_code,
      title: p.title,
      slug: p.slug,
      description: p.description,
      type: p.type,
      category: p.category,
      requirement_type: p.requirement_type,
      price: this.toNum(p.price),
      maintenance: this.toNum(p.maintenance),
      token_amount: this.toNum(p.token_amount),
      address: p.address,
      city: p.city,
      state: p.state,
      country: p.country,
      pincode: p.pincode,
      latitude: this.toNum(p.latitude),
      longitude: this.toNum(p.longitude),
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      balconies: p.balconies,
      floor: p.floor,
      total_floors: p.total_floors,
      super_builtup_area: this.toNum(p.super_builtup_area),
      carpet_area: this.toNum(p.carpet_area),
      status: p.status,
      is_public: p.is_public,
      meta_title: p.meta_title,
      meta_description: p.meta_description,
      amenities: p.amenities.map((a) => a.name),
      tags: p.tags.map((t) => t.tag),
      images: p.images.map((img) => ({
        id: img.id,
        url: this.storage.resolveUrl(img.url),
        thumbnail_url: this.storage.resolveUrl(img.thumbnail_url),
        alt_text: img.alt_text,
        sort_order: img.sort_order,
        is_cover: img.is_cover,
      })),
      videos: p.videos.map((v) => ({
        id: v.id,
        url: this.storage.resolveUrl(v.url),
        title: v.title,
        sort_order: v.sort_order,
      })),
      documents: p.documents.map((d) => ({
        id: d.id,
        name: d.name,
        url: this.storage.resolveUrl(d.url),
        doc_type: d.doc_type,
      })),
      assignments: p.assignments.map((a) => ({
        employee_id: a.employee_id,
        is_primary: a.is_primary,
        assigned_at: a.assigned_at.toISOString(),
        assigned_by: a.assigned_by,
        employee_name:
          [a.employee?.user?.first_name, a.employee?.user?.last_name].filter(Boolean).join(' ') ||
          a.employee?.user?.email ||
          null,
      })),
      cover_image_url: this.storage.resolveUrl(
        p.images.find((i) => i.is_cover)?.url ?? p.images[0]?.url ?? null,
      ),
      assigned_to:
        p.assignments.find((a) => a.is_primary)?.employee_id ??
        p.assignments[0]?.employee_id ??
        null,
      created_by: p.created_by,
      updated_by: p.updated_by,
      published_at: p.published_at?.toISOString() ?? null,
      created_at: p.created_at.toISOString(),
      updated_at: p.updated_at.toISOString(),
    };
  }

  // ===========================================================================
  // CRUD
  // ===========================================================================

  async create(
    tenantId: string,
    dto: CreatePropertyDto,
    actor: AuthUser,
    meta?: AuditRequestMeta,
  ) {
    await this.quota.assertCanCreateProperty(tenantId);

    const slug = dto.slug
      ? await this.generateUniqueSlug(tenantId, dto.slug)
      : await this.generateUniqueSlug(tenantId, dto.title);
    const propertyCode = await this.generatePropertyCode(tenantId);
    const status = dto.status ?? 'draft';

    const data: Prisma.propertiesCreateInput = {
      tenant: { connect: { id: tenantId } },
      property_code: propertyCode,
      title: dto.title,
      slug,
      description: dto.description,
      type: dto.type,
      category: dto.category,
      requirement_type: dto.requirement_type,
      price: dto.price ?? null,
      maintenance: dto.maintenance ?? null,
      token_amount: dto.token_amount ?? null,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      country: dto.country ?? 'India',
      pincode: dto.pincode,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      bedrooms: dto.bedrooms ?? null,
      bathrooms: dto.bathrooms ?? null,
      balconies: dto.balconies ?? null,
      floor: dto.floor ?? null,
      total_floors: dto.total_floors ?? null,
      super_builtup_area: dto.super_builtup_area ?? null,
      carpet_area: dto.carpet_area ?? null,
      status,
      is_public: dto.is_public ?? false,
      meta_title: dto.meta_title,
      meta_description: dto.meta_description,
      created_by: actor.userId,
      updated_by: actor.userId,
      published_at: status === 'published' ? new Date() : null,
    };

    const id = await this.repo.createProperty({
      tenantId,
      data,
      amenities: dto.amenities ?? [],
      tags: dto.tags ?? [],
      createdBy: actor.userId,
    });

    const created = await this.repo.findById(tenantId, id);
    const mapped = this.mapProperty(created!);

    await this.auditService.record({
      actor,
      tenantId,
      action: 'properties.created',
      entityType: 'property',
      entityId: id,
      afterState: { property_code: mapped.property_code, status: mapped.status },
      meta,
    });

    return mapped;
  }

  async importFromCsv(
    tenantId: string,
    dto: BulkImportPropertiesDto,
    actor: AuthUser,
    meta?: AuditRequestMeta,
  ): Promise<PropertyCsvImportResult> {
    const parsed = parsePropertyCsv(dto.csv_content);
    if (parsed.errors.length > 0) {
      throw new BadRequestException({
        code: 'CSV_INVALID',
        message: parsed.errors[0],
        errors: parsed.errors,
        rule_id: 'BR-P05',
      });
    }

    const results: PropertyCsvImportResult['results'] = [];
    let succeeded = 0;
    let failed = 0;

    for (let index = 0; index < parsed.rows.length; index += 1) {
      const rowNumber = index + 2;
      const record = parsed.rows[index]!;
      const mapped = await mapCsvRecordToCreateDto(record);
      if (mapped.errors.length > 0 || !mapped.dto) {
        failed += 1;
        results.push({ row: rowNumber, success: false, errors: mapped.errors });
        continue;
      }

      try {
        const created = await this.create(tenantId, mapped.dto, actor, meta);
        succeeded += 1;
        results.push({
          row: rowNumber,
          success: true,
          property_id: created.id,
          property_code: created.property_code,
          errors: [],
        });
      } catch (err) {
        failed += 1;
        results.push({
          row: rowNumber,
          success: false,
          errors: [this.errorMessage(err)],
        });
      }
    }

    await this.auditService.record({
      actor,
      tenantId,
      action: 'properties.imported',
      entityType: 'property',
      afterState: { total: parsed.rows.length, succeeded, failed },
      meta,
    });

    return {
      total: parsed.rows.length,
      succeeded,
      failed,
      results,
    };
  }

  async getNearbyPlaces(_tenantId: string, query: NearbyPlacesQueryDto) {
    const places = await fetchNearbyPlaces(query.latitude, query.longitude, query.radius_m ?? 1500);
    return { places, radius_m: query.radius_m ?? 1500 };
  }

  async geocodePropertyLocation(_tenantId: string, query: GeocodeQueryDto) {
    const result = await geocodeAddress({
      address: query.address,
      city: query.city,
      state: query.state,
      pincode: query.pincode,
      country: query.country,
    });
    if (!result) {
      throw new NotFoundException({
        code: 'GEOCODE_NOT_FOUND',
        message: 'No coordinates found for the provided address',
      });
    }
    return result;
  }

  private errorMessage(err: unknown): string {
    if (err instanceof BadRequestException || err instanceof UnprocessableEntityException) {
      const response = err.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: string | string[] }).message;
        return Array.isArray(message) ? message.join('; ') : String(message);
      }
    }
    return err instanceof Error ? err.message : 'Import failed';
  }

  async list(tenantId: string, user: AuthUser, query: ListPropertiesQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const scope = await this.resolveScope(user, tenantId);

    const where = this.repo.buildWhere(
      tenantId,
      {
        search: query.search,
        type: (query['filter[type]'] ?? query.filter?.type) as string | undefined,
        category: (query['filter[category]'] ?? query.filter?.category) as string | undefined,
        status: (query['filter[status]'] ?? query.filter?.status) as string | undefined,
        requirementType: (query['filter[requirement_type]'] ?? query.filter?.requirement_type) as
          | string
          | undefined,
        city: (query['filter[city]'] ?? query.filter?.city) as string | undefined,
        assignedUser: (query['filter[assigned_user]'] ?? query.filter?.assigned_user) as string | undefined,
        minPrice: (query['filter[min_price]'] ?? query.filter?.min_price) as number | undefined,
        maxPrice: (query['filter[max_price]'] ?? query.filter?.max_price) as number | undefined,
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
      data: rows.map((row) => this.mapProperty(row as WithRelations)),
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async summary(tenantId: string, user: AuthUser, query: ListPropertiesQueryDto) {
    const scope = await this.resolveScope(user, tenantId);
    const where = this.repo.buildWhere(
      tenantId,
      {
        search: query.search,
        type: (query['filter[type]'] ?? query.filter?.type) as string | undefined,
        category: (query['filter[category]'] ?? query.filter?.category) as string | undefined,
        status: (query['filter[status]'] ?? query.filter?.status) as string | undefined,
        requirementType: (query['filter[requirement_type]'] ?? query.filter?.requirement_type) as
          | string
          | undefined,
        city: (query['filter[city]'] ?? query.filter?.city) as string | undefined,
        assignedUser: (query['filter[assigned_user]'] ?? query.filter?.assigned_user) as string | undefined,
        minPrice: (query['filter[min_price]'] ?? query.filter?.min_price) as number | undefined,
        maxPrice: (query['filter[max_price]'] ?? query.filter?.max_price) as number | undefined,
      },
      scope,
    );
    const { statusRows, publicCount, totalValue } = await this.repo.summary(where);
    const byStatus: Record<string, number> = {};
    for (const status of PROPERTY_STATUSES) byStatus[status] = 0;
    let total = 0;
    for (const row of statusRows) {
      byStatus[row.status] = row._count._all;
      total += row._count._all;
    }

    return {
      total,
      published: byStatus.published ?? 0,
      reserved: byStatus.reserved ?? 0,
      sold: byStatus.sold ?? 0,
      draft: byStatus.draft ?? 0,
      public_listings: publicCount,
      total_value: totalValue == null ? 0 : Number(totalValue),
      by_status: byStatus,
    };
  }

  async getOne(tenantId: string, user: AuthUser, id: string) {
    const property = await this.repo.findById(tenantId, id);
    if (!property) throw new NotFoundException('Property not found');
    await this.assertCanAccess(user, tenantId, property);
    return this.mapProperty(property);
  }

  async update(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: UpdatePropertyDto,
    meta?: AuditRequestMeta,
  ) {
    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Property not found');
    await this.assertCanAccess(user, tenantId, existing);

    const data: Prisma.propertiesUpdateInput = { updated_by: user.userId };
    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    const historyEntries: {
      change_type: string;
      changed_fields: Prisma.InputJsonValue;
      changed_by?: string | null;
    }[] = [];

    // Scalar fields (simple set-if-provided).
    const assignIf = <K extends keyof Prisma.propertiesUpdateInput>(
      key: K,
      value: Prisma.propertiesUpdateInput[K],
    ) => {
      data[key] = value;
    };

    if (dto.title !== undefined) assignIf('title', dto.title);
    if (dto.description !== undefined) assignIf('description', dto.description);
    if (dto.type !== undefined) assignIf('type', dto.type);
    if (dto.category !== undefined) assignIf('category', dto.category);
    if (dto.requirement_type !== undefined) assignIf('requirement_type', dto.requirement_type);
    if (dto.maintenance !== undefined) assignIf('maintenance', dto.maintenance ?? null);
    if (dto.token_amount !== undefined) assignIf('token_amount', dto.token_amount ?? null);
    if (dto.address !== undefined) assignIf('address', dto.address);
    if (dto.city !== undefined) assignIf('city', dto.city);
    if (dto.state !== undefined) assignIf('state', dto.state);
    if (dto.country !== undefined) assignIf('country', dto.country);
    if (dto.pincode !== undefined) assignIf('pincode', dto.pincode);
    if (dto.latitude !== undefined) assignIf('latitude', dto.latitude ?? null);
    if (dto.longitude !== undefined) assignIf('longitude', dto.longitude ?? null);
    if (dto.bedrooms !== undefined) assignIf('bedrooms', dto.bedrooms ?? null);
    if (dto.bathrooms !== undefined) assignIf('bathrooms', dto.bathrooms ?? null);
    if (dto.balconies !== undefined) assignIf('balconies', dto.balconies ?? null);
    if (dto.floor !== undefined) assignIf('floor', dto.floor ?? null);
    if (dto.total_floors !== undefined) assignIf('total_floors', dto.total_floors ?? null);
    if (dto.super_builtup_area !== undefined)
      assignIf('super_builtup_area', dto.super_builtup_area ?? null);
    if (dto.carpet_area !== undefined) assignIf('carpet_area', dto.carpet_area ?? null);
    if (dto.meta_title !== undefined) assignIf('meta_title', dto.meta_title);
    if (dto.meta_description !== undefined) assignIf('meta_description', dto.meta_description);
    if (dto.is_public !== undefined) assignIf('is_public', dto.is_public);

    // Slug override (admin only — BR-P01). Re-uniquify.
    if (dto.slug !== undefined && dto.slug && dto.slug !== existing.slug) {
      const newSlug = await this.generateUniqueSlug(tenantId, dto.slug, id);
      assignIf('slug', newSlug);
      changedFields.slug = { from: existing.slug, to: newSlug };
    }

    // Price change => dedicated history entry.
    if (dto.price !== undefined) {
      const newPrice = dto.price ?? null;
      const oldPrice = this.toNum(existing.price);
      assignIf('price', newPrice);
      if (oldPrice !== newPrice) {
        historyEntries.push({
          change_type: 'price_changed',
          changed_fields: { from: oldPrice, to: newPrice } as Prisma.InputJsonValue,
          changed_by: user.userId,
        });
      }
    }

    // Status workflow.
    if (dto.status !== undefined && dto.status !== existing.status) {
      this.validateStatusTransition(existing.status, dto.status);
      assignIf('status', dto.status);
      if (dto.status === 'published' && !existing.published_at) {
        assignIf('published_at', new Date());
      }
      if (dto.status === 'sold' || dto.status === 'archived') {
        assignIf('is_public', false); // BR-P03 / BR-P07
      }
      historyEntries.push({
        change_type: 'status_changed',
        changed_fields: { from: existing.status, to: dto.status } as Prisma.InputJsonValue,
        changed_by: user.userId,
      });
    }

    const amenitiesChanged = dto.amenities !== undefined;
    const tagsChanged = dto.tags !== undefined;

    // Generic "property_updated" entry summarising scalar changes.
    for (const key of Object.keys(data)) {
      if (key === 'updated_by' || key === 'published_at') continue;
      if (key === 'price' || key === 'status') continue; // already tracked
      changedFields[key] = { from: (existing as any)[key] ?? null, to: (data as any)[key] };
    }
    if (amenitiesChanged) changedFields.amenities = { from: existing.amenities.map((a) => a.name), to: dto.amenities };
    if (tagsChanged) changedFields.tags = { from: existing.tags.map((t) => t.tag), to: dto.tags };

    if (Object.keys(changedFields).length) {
      historyEntries.push({
        change_type: 'property_updated',
        changed_fields: changedFields as Prisma.InputJsonValue,
        changed_by: user.userId,
      });
    }

    await this.repo.updateProperty({
      tenantId,
      id,
      data,
      amenities: amenitiesChanged ? dto.amenities : undefined,
      tags: tagsChanged ? dto.tags : undefined,
      historyEntries: historyEntries.map((h) => ({ ...h, changed_by_email: null })),
    });

    const updated = await this.repo.findById(tenantId, id);
    const mapped = this.mapProperty(updated!);

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'properties.updated',
      entityType: 'property',
      entityId: id,
      beforeState: { status: existing.status, price: this.toNum(existing.price) },
      afterState: { status: mapped.status, price: mapped.price },
      meta,
    });

    // Phase 5: notify assigned agents when the status changes.
    if (dto.status !== undefined && dto.status !== existing.status) {
      const ctx = {
        propertyCode: mapped.property_code,
        propertyTitle: mapped.title,
        fromStatus: existing.status,
        toStatus: dto.status,
      };
      for (const employeeId of existing.assignments.map((a) => a.employee_id)) {
        this.events.emit(DOMAIN_EVENTS.PROPERTY_STATUS_CHANGED, {
          tenantId,
          actorUserId: user.userId,
          entityType: 'property',
          entityId: id,
          context: { ...ctx, employeeId },
        });
      }
    }

    return mapped;
  }

  async remove(tenantId: string, user: AuthUser, id: string, meta?: AuditRequestMeta) {
    const existing = await this.repo.findById(tenantId, id);
    if (!existing) throw new NotFoundException('Property not found');
    await this.assertCanAccess(user, tenantId, existing);

    const deleted = await this.repo.softDelete(tenantId, id);
    if (!deleted) throw new NotFoundException('Property not found');

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'properties.deleted',
      entityType: 'property',
      entityId: id,
      beforeState: { property_code: existing.property_code, status: existing.status },
      meta,
    });

    return { id, deleted: true };
  }

  // ===========================================================================
  // Assignment (BR-P06: max 1 primary agent)
  // ===========================================================================

  async assign(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: AssignPropertyDto,
    meta?: AuditRequestMeta,
  ) {
    const property = await this.repo.findById(tenantId, id);
    if (!property) throw new NotFoundException('Property not found');
    await this.assertCanAccess(user, tenantId, property);

    const uniqueIds = Array.from(new Set(dto.employee_ids));
    const employees = await this.repo.findEmployeesByIds(tenantId, uniqueIds);
    if (employees.length !== uniqueIds.length) {
      throw new BadRequestException('One or more employee_ids are invalid for this tenant');
    }
    if (dto.primary_employee_id && !uniqueIds.includes(dto.primary_employee_id)) {
      throw new BadRequestException('primary_employee_id must be one of employee_ids');
    }

    const previous = property.assignments.map((a) => a.employee_id);

    await this.repo.replaceAssignments({
      tenantId,
      propertyId: id,
      employeeIds: uniqueIds,
      primaryEmployeeId: dto.primary_employee_id ?? uniqueIds[0],
      assignedBy: user.userId,
      changedFields: {
        from: previous,
        to: uniqueIds,
        primary: dto.primary_employee_id ?? uniqueIds[0],
      } as Prisma.InputJsonValue,
    });

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'properties.assigned',
      entityType: 'property',
      entityId: id,
      beforeState: { assigned: previous },
      afterState: { assigned: uniqueIds, primary: dto.primary_employee_id ?? uniqueIds[0] },
      meta,
    });

    // Phase 5: notify employees newly assigned to this property.
    const newlyAssigned = uniqueIds.filter((eid) => !previous.includes(eid));
    for (const employeeId of newlyAssigned) {
      this.events.emit(DOMAIN_EVENTS.PROPERTY_ASSIGNED, {
        tenantId,
        actorUserId: user.userId,
        entityType: 'property',
        entityId: id,
        context: {
          employeeId,
          propertyCode: property.property_code,
          propertyTitle: property.title,
        },
      });
    }

    const updated = await this.repo.findById(tenantId, id);
    return this.mapProperty(updated!);
  }

  // ===========================================================================
  // History
  // ===========================================================================

  async getHistory(
    tenantId: string,
    user: AuthUser,
    id: string,
    page?: number,
    perPage?: number,
  ) {
    const property = await this.repo.findById(tenantId, id);
    if (!property) throw new NotFoundException('Property not found');
    await this.assertCanAccess(user, tenantId, property);

    const pagination = resolvePagination(page, perPage);
    const { rows, total } = await this.repo.listHistory(tenantId, id, pagination);
    const data = rows.map((r) => ({
      id: r.id,
      change_type: r.change_type,
      changed_fields: r.changed_fields,
      changed_by: r.changed_by,
      changed_by_email: r.changed_by_email,
      created_at: r.created_at.toISOString(),
    }));
    if (!pagination || total === null) return { data };
    return { data, pagination: paginationMeta(pagination.page, pagination.perPage, total) };
  }

  // ===========================================================================
  // Media — images
  // ===========================================================================

  private assertValidPropertyImageUpload(contentBase64: string, contentType?: string): void {
    const bytes = this.storage.decodedByteLength(contentBase64);
    if (bytes > PROPERTY_IMAGE_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'IMAGE_TOO_LARGE',
        message: `Image exceeds the ${PROPERTY_IMAGE_MAX_BYTES / (1024 * 1024)} MB limit`,
      });
    }
    if (!contentType) {
      throw new BadRequestException('content_type is required for image uploads');
    }
    if (!(ALLOWED_PROPERTY_IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      throw new BadRequestException(`Unsupported image type: ${contentType}`);
    }
  }

  private assertValidPropertyVideoUpload(contentBase64: string, contentType?: string): void {
    const bytes = this.storage.decodedByteLength(contentBase64);
    if (bytes > PROPERTY_VIDEO_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'VIDEO_TOO_LARGE',
        message: `Video exceeds the ${PROPERTY_VIDEO_MAX_BYTES / (1024 * 1024)} MB limit`,
      });
    }
    if (!contentType) {
      throw new BadRequestException('content_type is required for video uploads');
    }
    if (!(ALLOWED_PROPERTY_VIDEO_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      throw new BadRequestException(`Unsupported video type: ${contentType}`);
    }
  }

  private async getAccessibleProperty(tenantId: string, user: AuthUser, id: string) {
    const property = await this.repo.findById(tenantId, id);
    if (!property) throw new NotFoundException('Property not found');
    await this.assertCanAccess(user, tenantId, property);
    return property;
  }

  async addImage(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: AddImageDto,
    meta?: AuditRequestMeta,
  ) {
    await this.getAccessibleProperty(tenantId, user, id);

    let url = dto.url ?? null;
    let storageKey: string | null = null;
    const uploadBytes = dto.content_base64
      ? this.storage.decodedByteLength(dto.content_base64)
      : 0;
    if (uploadBytes > 0) {
      await this.quota.assertStorageAvailable(tenantId, uploadBytes);
    }
    if (!url && dto.content_base64) {
      this.assertValidPropertyImageUpload(dto.content_base64, dto.content_type);
      const stored = await this.storage.saveBase64({
        tenantId,
        propertyId: id,
        kind: 'images',
        filename: dto.filename,
        contentBase64: dto.content_base64,
        contentType: dto.content_type,
      });
      // Persist only the storage key (name/path), not the full host URL. The
      // public URL is resolved at read time from the active storage provider.
      storageKey = stored.storageKey;
      url = stored.storageKey;
    }
    if (!url) throw new BadRequestException('Provide either url or content_base64');

    const image = await this.repo.addImage({
      tenantId,
      propertyId: id,
      url,
      storageKey,
      altText: dto.alt_text,
      isCover: dto.is_cover ?? false,
    });

    if (uploadBytes > 0) {
      await this.quota.recordStorageBytes(tenantId, uploadBytes);
    }

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'properties.image.added',
      entityType: 'property',
      entityId: id,
      afterState: { image_id: image.id },
      meta,
    });

    return {
      id: image.id,
      url: this.storage.resolveUrl(image.url),
      thumbnail_url: this.storage.resolveUrl(image.thumbnail_url),
      alt_text: image.alt_text,
      sort_order: image.sort_order,
      is_cover: image.is_cover,
    };
  }

  async deleteImage(
    tenantId: string,
    user: AuthUser,
    id: string,
    imageId: string,
    meta?: AuditRequestMeta,
  ) {
    await this.getAccessibleProperty(tenantId, user, id);
    const image = await this.repo.deleteImage(tenantId, id, imageId);
    if (!image) throw new NotFoundException('Image not found');
    await this.storage.delete(image.storage_key);

    await this.auditService.record({
      actor: user,
      tenantId,
      action: 'properties.image.deleted',
      entityType: 'property',
      entityId: id,
      beforeState: { image_id: imageId },
      meta,
    });

    return { id: imageId, deleted: true };
  }

  async reorderImages(tenantId: string, user: AuthUser, id: string, dto: ReorderImagesDto) {
    await this.getAccessibleProperty(tenantId, user, id);
    const ok = await this.repo.reorderImages(tenantId, id, dto.image_ids);
    if (!ok) throw new BadRequestException('image_ids must contain exactly all property images');
    const updated = await this.repo.findById(tenantId, id);
    return this.mapProperty(updated!).images;
  }

  async setCoverImage(tenantId: string, user: AuthUser, id: string, imageId: string) {
    await this.getAccessibleProperty(tenantId, user, id);
    const ok = await this.repo.setCoverImage(tenantId, id, imageId);
    if (!ok) throw new NotFoundException('Image not found');
    const updated = await this.repo.findById(tenantId, id);
    return this.mapProperty(updated!).images;
  }

  // ===========================================================================
  // Media — videos & documents
  // ===========================================================================

  async addVideo(tenantId: string, user: AuthUser, id: string, dto: AddVideoDto) {
    await this.getAccessibleProperty(tenantId, user, id);
    let url = dto.url ?? null;
    let storageKey: string | null = null;
    const uploadBytes = dto.content_base64
      ? this.storage.decodedByteLength(dto.content_base64)
      : 0;
    if (uploadBytes > 0) {
      await this.quota.assertStorageAvailable(tenantId, uploadBytes);
    }
    if (!url && dto.content_base64) {
      this.assertValidPropertyVideoUpload(dto.content_base64, dto.content_type);
      const stored = await this.storage.saveBase64({
        tenantId,
        propertyId: id,
        kind: 'videos',
        filename: dto.filename,
        contentBase64: dto.content_base64,
        contentType: dto.content_type,
      });
      storageKey = stored.storageKey;
      url = stored.storageKey;
    }
    if (!url) throw new BadRequestException('Provide either url or content_base64');
    const video = await this.repo.addVideo({
      tenantId,
      propertyId: id,
      url,
      storageKey,
      title: dto.title,
      sortOrder: dto.sort_order,
    });
    if (uploadBytes > 0) {
      await this.quota.recordStorageBytes(tenantId, uploadBytes);
    }
    return {
      id: video.id,
      url: this.storage.resolveUrl(video.url),
      title: video.title,
      sort_order: video.sort_order,
    };
  }

  async deleteVideo(tenantId: string, user: AuthUser, id: string, videoId: string) {
    await this.getAccessibleProperty(tenantId, user, id);
    const video = await this.repo.deleteVideo(tenantId, id, videoId);
    if (!video) throw new NotFoundException('Video not found');
    await this.storage.delete(video.storage_key);
    return { id: videoId, deleted: true };
  }

  async addDocument(tenantId: string, user: AuthUser, id: string, dto: AddDocumentDto) {
    await this.getAccessibleProperty(tenantId, user, id);
    let url = dto.url ?? null;
    let storageKey: string | null = null;
    const uploadBytes = dto.content_base64
      ? this.storage.decodedByteLength(dto.content_base64)
      : 0;
    if (uploadBytes > 0) {
      await this.quota.assertStorageAvailable(tenantId, uploadBytes);
    }
    if (!url && dto.content_base64) {
      const stored = await this.storage.saveBase64({
        tenantId,
        propertyId: id,
        kind: 'documents',
        filename: dto.filename,
        contentBase64: dto.content_base64,
        contentType: dto.content_type,
      });
      storageKey = stored.storageKey;
      url = stored.storageKey;
    }
    if (!url) throw new BadRequestException('Provide either url or content_base64');
    const doc = await this.repo.addDocument({
      tenantId,
      propertyId: id,
      name: dto.name,
      url,
      storageKey,
      docType: dto.doc_type,
    });
    if (uploadBytes > 0) {
      await this.quota.recordStorageBytes(tenantId, uploadBytes);
    }
    return {
      id: doc.id,
      name: doc.name,
      url: this.storage.resolveUrl(doc.url),
      doc_type: doc.doc_type,
    };
  }

  async deleteDocument(tenantId: string, user: AuthUser, id: string, documentId: string) {
    await this.getAccessibleProperty(tenantId, user, id);
    const doc = await this.repo.deleteDocument(tenantId, id, documentId);
    if (!doc) throw new NotFoundException('Document not found');
    await this.storage.delete(doc.storage_key);
    return { id: documentId, deleted: true };
  }

  // ===========================================================================
  // Public listing (no auth) — never leak internal fields
  // ===========================================================================

  private async resolveTenant(slug?: string) {
    if (!slug) throw new BadRequestException('tenant slug is required');
    const org = await this.repo.findOrganizationBySlug(slug);
    if (!org || org.status === 'suspended') throw new NotFoundException('Listing not available');
    return org;
  }

  private mapPublic(p: {
    title: string;
    slug: string;
    description: string | null;
    type: string;
    category: string;
    requirement_type: string;
    price: Prisma.Decimal | null;
    maintenance: Prisma.Decimal | null;
    city: string;
    state: string | null;
    country: string;
    pincode: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    balconies: number | null;
    super_builtup_area: Prisma.Decimal | null;
    carpet_area: Prisma.Decimal | null;
    meta_title: string | null;
    meta_description: string | null;
    published_at: Date | null;
    images: { url: string; alt_text: string | null; is_cover: boolean; sort_order: number }[];
    amenities: { name: string }[];
    tags: { tag: string }[];
    videos?: { url: string; title: string | null }[];
  }) {
    return {
      title: p.title,
      slug: p.slug,
      description: p.description,
      type: p.type,
      category: p.category,
      requirement_type: p.requirement_type,
      price: this.toNum(p.price),
      maintenance: this.toNum(p.maintenance),
      city: p.city,
      state: p.state,
      country: p.country,
      pincode: p.pincode,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      balconies: p.balconies,
      super_builtup_area: this.toNum(p.super_builtup_area),
      carpet_area: this.toNum(p.carpet_area),
      meta_title: p.meta_title ?? p.title,
      meta_description: p.meta_description,
      amenities: p.amenities.map((a) => a.name),
      tags: p.tags.map((t) => t.tag),
      images: p.images.map((i) => ({
        url: this.storage.resolveUrl(i.url),
        alt_text: i.alt_text,
        is_cover: i.is_cover,
      })),
      videos: (p.videos ?? []).map((v) => ({ url: this.storage.resolveUrl(v.url), title: v.title })),
      cover_image_url: this.storage.resolveUrl(
        p.images.find((i) => i.is_cover)?.url ?? p.images[0]?.url ?? null,
      ),
      published_at: p.published_at?.toISOString() ?? null,
    };
  }

  async listPublic(query: {
    tenant?: string;
    search?: string;
    type?: string;
    category?: string;
    requirementType?: string;
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    page: number;
    perPage: number;
  }) {
    const org = await this.resolveTenant(query.tenant);
    const { rows, total } = await this.repo.listPublic({
      tenantId: org.id,
      filters: {
        search: query.search,
        type: query.type,
        category: query.category,
        requirementType: query.requirementType,
        city: query.city,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
      },
      page: query.page,
      perPage: query.perPage,
    });
    return {
      data: rows.map((r) => this.mapPublic(r as never)),
      meta: {
        page: query.page,
        per_page: query.perPage,
        total,
        total_pages: Math.ceil(total / query.perPage) || 1,
        tenant: org.slug,
      },
    };
  }

  async getPublicBySlug(slug: string, tenantSlug?: string) {
    const org = await this.resolveTenant(tenantSlug);
    const property = await this.repo.findPublicBySlug(org.id, slug);
    if (!property) throw new NotFoundException('Listing not found');
    return this.mapPublic(property as never);
  }
}
