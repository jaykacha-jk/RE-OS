import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { tierToPlanCode } from '../platform/org-tier';

export type PropertyScope = { type: 'all' } | { type: 'employees'; employeeIds: string[] };

export type PropertyListFilters = {
  search?: string;
  type?: string;
  category?: string;
  status?: string;
  requirementType?: string;
  city?: string;
  assignedUser?: string;
  minPrice?: number;
  maxPrice?: number;
};

const propertyInclude = {
  images: { orderBy: [{ is_cover: 'desc' as const }, { sort_order: 'asc' as const }] },
  videos: { orderBy: { sort_order: 'asc' as const } },
  documents: { orderBy: { created_at: 'asc' as const } },
  amenities: true,
  tags: true,
  assignments: {
    include: {
      employee: { include: { user: { select: { first_name: true, last_name: true, email: true } } } },
    },
  },
} satisfies Prisma.propertiesInclude;

@Injectable()
export class PropertiesRepository extends TenantScopedRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // --- Quota / org -----------------------------------------------------------

  async findOrganizationWithUsage(tenantId: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { id: tenantId, deleted_at: null },
      include: { organization_usage: true },
    });
  }

  async findPlanMaxProperties(tier: string) {
    const planCode = tierToPlanCode(tier);
    return this.prisma.dbClient.subscription_plans.findUnique({
      where: { code: planCode },
      select: { max_properties: true },
    });
  }

  // --- Employees (for assignment + scope) ------------------------------------

  async findEmployeeByUserId(tenantId: string, userId: string) {
    return this.prisma.dbClient.employees.findFirst({
      where: { user_id: userId, deleted_at: null, user: { tenant_id: tenantId, deleted_at: null } },
    });
  }

  async findEmployeeById(tenantId: string, employeeId: string) {
    return this.prisma.dbClient.employees.findFirst({
      where: {
        id: employeeId,
        deleted_at: null,
        user: { tenant_id: tenantId, deleted_at: null },
      },
    });
  }

  async findEmployeesByIds(tenantId: string, employeeIds: string[]) {
    return this.prisma.dbClient.employees.findMany({
      where: {
        id: { in: employeeIds },
        deleted_at: null,
        user: { tenant_id: tenantId, deleted_at: null },
      },
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

  // --- Uniqueness ------------------------------------------------------------

  async slugExists(tenantId: string, slug: string, excludeId?: string) {
    const found = await this.prisma.dbClient.properties.findFirst({
      where: { tenant_id: tenantId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return !!found;
  }

  async propertyCodeExists(tenantId: string, code: string) {
    const found = await this.prisma.dbClient.properties.findFirst({
      where: { tenant_id: tenantId, property_code: code },
      select: { id: true },
    });
    return !!found;
  }

  // --- CRUD ------------------------------------------------------------------

  async createProperty(input: {
    tenantId: string;
    data: Prisma.propertiesCreateInput;
    amenities: string[];
    tags: string[];
    createdBy?: string | null;
    createdByEmail?: string | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const property = await tx.properties.create({ data: input.data });

      if (input.amenities.length) {
        await tx.property_amenities.createMany({
          data: input.amenities.map((name) => ({
            tenant_id: input.tenantId,
            property_id: property.id,
            name,
          })),
          skipDuplicates: true,
        });
      }
      if (input.tags.length) {
        await tx.property_tags.createMany({
          data: input.tags.map((tag) => ({
            tenant_id: input.tenantId,
            property_id: property.id,
            tag,
          })),
          skipDuplicates: true,
        });
      }

      await tx.property_history.create({
        data: {
          tenant_id: input.tenantId,
          property_id: property.id,
          change_type: 'created',
          changed_fields: { status: property.status } as Prisma.InputJsonValue,
          changed_by: input.createdBy ?? null,
          changed_by_email: input.createdByEmail ?? null,
        },
      });

      await tx.organization_usage.update({
        where: { tenant_id: input.tenantId },
        data: { properties_count: { increment: 1 } },
      });

      return property.id;
    });
  }

  async findById(tenantId: string, id: string) {
    return this.prisma.dbClient.properties.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: propertyInclude,
    });
  }

  buildWhere(
    tenantId: string,
    filters: PropertyListFilters,
    scope: PropertyScope,
  ): Prisma.propertiesWhereInput {
    const where: Prisma.propertiesWhereInput = this.tenantWhere(tenantId, {
      deleted_at: null,
    });

    if (filters.type) where.type = filters.type;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.requirementType) where.requirement_type = filters.requirementType;
    if (filters.city) where.city = { equals: filters.city, mode: 'insensitive' };

    if (filters.minPrice != null || filters.maxPrice != null) {
      where.price = {
        ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
        ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
      };
    }

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { property_code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Assignment-based constraints (explicit filter + RBAC scope).
    const assignmentEmployeeIds: string[] | null =
      scope.type === 'employees' ? scope.employeeIds : null;

    if (filters.assignedUser) {
      where.assignments = {
        some: {
          employee_id:
            assignmentEmployeeIds && !assignmentEmployeeIds.includes(filters.assignedUser)
              ? '00000000-0000-0000-0000-000000000000' // scope + filter disjoint => no rows
              : filters.assignedUser,
        },
      };
    } else if (assignmentEmployeeIds) {
      where.assignments = { some: { employee_id: { in: assignmentEmployeeIds } } };
    }

    return where;
  }

  async list(input: {
    where: Prisma.propertiesWhereInput;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    page: number;
    perPage: number;
  }) {
    this.assertTenantWhere('PropertiesRepository.list', input.where as Record<string, unknown>);
    const orderBy: Prisma.propertiesOrderByWithRelationInput = {
      [input.sortBy]: input.sortDir,
    };

    const [rows, total] = await Promise.all([
      this.prisma.dbClient.properties.findMany({
        where: input.where,
        include: propertyInclude,
        orderBy,
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.dbClient.properties.count({ where: input.where }),
    ]);

    return { rows, total };
  }

  async summary(where: Prisma.propertiesWhereInput) {
    this.assertTenantWhere('PropertiesRepository.summary', where as Record<string, unknown>);
    const [statusRows, publicCount, value] = await Promise.all([
      this.prisma.dbClient.properties.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.dbClient.properties.count({ where: { ...where, is_public: true } }),
      this.prisma.dbClient.properties.aggregate({
        where,
        _sum: { price: true },
      }),
    ]);
    return {
      statusRows,
      publicCount,
      totalValue: value._sum.price,
    };
  }

  async updateProperty(input: {
    tenantId: string;
    id: string;
    data: Prisma.propertiesUpdateInput;
    amenities?: string[];
    tags?: string[];
    historyEntries: {
      change_type: string;
      changed_fields: Prisma.InputJsonValue;
      changed_by?: string | null;
      changed_by_email?: string | null;
    }[];
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const updated = await tx.properties.updateMany({
        where: { id: input.id, tenant_id: input.tenantId, deleted_at: null },
        data: input.data,
      });
      if (updated.count !== 1) return false;

      if (input.amenities) {
        await tx.property_amenities.deleteMany({
          where: { property_id: input.id, tenant_id: input.tenantId },
        });
        if (input.amenities.length) {
          await tx.property_amenities.createMany({
            data: input.amenities.map((name) => ({
              tenant_id: input.tenantId,
              property_id: input.id,
              name,
            })),
            skipDuplicates: true,
          });
        }
      }
      if (input.tags) {
        await tx.property_tags.deleteMany({
          where: { property_id: input.id, tenant_id: input.tenantId },
        });
        if (input.tags.length) {
          await tx.property_tags.createMany({
            data: input.tags.map((tag) => ({
              tenant_id: input.tenantId,
              property_id: input.id,
              tag,
            })),
            skipDuplicates: true,
          });
        }
      }

      for (const entry of input.historyEntries) {
        await tx.property_history.create({
          data: {
            tenant_id: input.tenantId,
            property_id: input.id,
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
    return this.prisma.dbClient.$transaction(async (tx) => {
      const existing = await tx.properties.findFirst({
        where: { id, tenant_id: tenantId, deleted_at: null },
        select: { id: true },
      });
      if (!existing) return false;

      await tx.properties.updateMany({
        where: { id, tenant_id: tenantId, deleted_at: null },
        data: { deleted_at: new Date(), is_public: false },
      });
      await tx.organization_usage.update({
        where: { tenant_id: tenantId },
        data: { properties_count: { decrement: 1 } },
      });
      return true;
    });
  }

  // --- Assignment ------------------------------------------------------------

  async replaceAssignments(input: {
    tenantId: string;
    propertyId: string;
    employeeIds: string[];
    primaryEmployeeId?: string;
    assignedBy?: string | null;
    assignedByEmail?: string | null;
    changedFields: Prisma.InputJsonValue;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      await tx.property_assignments.deleteMany({
        where: { property_id: input.propertyId, tenant_id: input.tenantId },
      });
      const now = new Date();
      for (const employeeId of input.employeeIds) {
        await tx.property_assignments.create({
          data: {
            tenant_id: input.tenantId,
            property_id: input.propertyId,
            employee_id: employeeId,
            assigned_by: input.assignedBy ?? null,
            is_primary: employeeId === input.primaryEmployeeId,
            assigned_at: now,
          },
        });
      }
      await tx.property_history.create({
        data: {
          tenant_id: input.tenantId,
          property_id: input.propertyId,
          change_type: 'assignment_changed',
          changed_fields: input.changedFields,
          changed_by: input.assignedBy ?? null,
          changed_by_email: input.assignedByEmail ?? null,
        },
      });
    });
  }

  // --- History ---------------------------------------------------------------

  async listHistory(
    tenantId: string,
    propertyId: string,
    pagination?: { skip: number; perPage: number } | null,
  ) {
    const where = { tenant_id: tenantId, property_id: propertyId };
    const orderBy = { created_at: 'desc' as const };
    if (!pagination) {
      const rows = await this.prisma.dbClient.property_history.findMany({ where, orderBy });
      return { rows, total: null as number | null };
    }
    const [rows, total] = await Promise.all([
      this.prisma.dbClient.property_history.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.perPage,
      }),
      this.prisma.dbClient.property_history.count({ where }),
    ]);
    return { rows, total };
  }

  // --- Images ----------------------------------------------------------------

  async findImage(tenantId: string, propertyId: string, imageId: string) {
    return this.prisma.dbClient.property_images.findFirst({
      where: { id: imageId, property_id: propertyId, tenant_id: tenantId },
    });
  }

  async countImages(tenantId: string, propertyId: string) {
    return this.prisma.dbClient.property_images.count({ where: { property_id: propertyId, tenant_id: tenantId } });
  }

  async addImage(input: {
    tenantId: string;
    propertyId: string;
    url: string;
    storageKey?: string | null;
    thumbnailUrl?: string | null;
    altText?: string | null;
    isCover: boolean;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const max = await tx.property_images.aggregate({
        where: { property_id: input.propertyId, tenant_id: input.tenantId },
        _max: { sort_order: true },
      });
      const nextOrder = (max._max.sort_order ?? -1) + 1;
      const existingCount = await tx.property_images.count({
        where: { property_id: input.propertyId, tenant_id: input.tenantId },
      });
      const isCover = input.isCover || existingCount === 0;

      if (isCover) {
        await tx.property_images.updateMany({
          where: { property_id: input.propertyId, tenant_id: input.tenantId },
          data: { is_cover: false },
        });
      }

      return tx.property_images.create({
        data: {
          tenant_id: input.tenantId,
          property_id: input.propertyId,
          url: input.url,
          storage_key: input.storageKey ?? null,
          thumbnail_url: input.thumbnailUrl ?? null,
          alt_text: input.altText ?? null,
          sort_order: nextOrder,
          is_cover: isCover,
        },
      });
    });
  }

  async deleteImage(tenantId: string, propertyId: string, imageId: string) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const image = await tx.property_images.findFirst({
        where: { id: imageId, property_id: propertyId, tenant_id: tenantId },
      });
      if (!image) return null;
      await tx.property_images.deleteMany({ where: { id: imageId, property_id: propertyId, tenant_id: tenantId } });

      // Promote a new cover if we removed the cover image.
      if (image.is_cover) {
        const next = await tx.property_images.findFirst({
          where: { property_id: propertyId, tenant_id: tenantId },
          orderBy: { sort_order: 'asc' },
        });
        if (next) {
          await tx.property_images.updateMany({
            where: { id: next.id, property_id: propertyId, tenant_id: tenantId },
            data: { is_cover: true },
          });
        }
      }
      return image;
    });
  }

  async reorderImages(tenantId: string, propertyId: string, imageIds: string[]) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const images = await tx.property_images.findMany({
        where: { property_id: propertyId, tenant_id: tenantId },
        select: { id: true },
      });
      const valid = new Set(images.map((i) => i.id));
      if (images.length !== imageIds.length || imageIds.some((id) => !valid.has(id))) {
        return false;
      }
      for (let i = 0; i < imageIds.length; i++) {
        await tx.property_images.updateMany({
          where: { id: imageIds[i], property_id: propertyId, tenant_id: tenantId },
          data: { sort_order: i },
        });
      }
      return true;
    });
  }

  async setCoverImage(tenantId: string, propertyId: string, imageId: string) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const image = await tx.property_images.findFirst({
        where: { id: imageId, property_id: propertyId, tenant_id: tenantId },
      });
      if (!image) return false;
      await tx.property_images.updateMany({
        where: { property_id: propertyId, tenant_id: tenantId },
        data: { is_cover: false },
      });
      await tx.property_images.updateMany({
        where: { id: imageId, property_id: propertyId, tenant_id: tenantId },
        data: { is_cover: true },
      });
      return true;
    });
  }

  // --- Videos / documents ----------------------------------------------------

  async addVideo(input: {
    tenantId: string;
    propertyId: string;
    url: string;
    storageKey?: string | null;
    title?: string | null;
    sortOrder?: number;
  }) {
    return this.prisma.dbClient.property_videos.create({
      data: {
        tenant_id: input.tenantId,
        property_id: input.propertyId,
        url: input.url,
        storage_key: input.storageKey ?? null,
        title: input.title ?? null,
        sort_order: input.sortOrder ?? 0,
      },
    });
  }

  async findVideo(tenantId: string, propertyId: string, videoId: string) {
    return this.prisma.dbClient.property_videos.findFirst({
      where: { id: videoId, property_id: propertyId, tenant_id: tenantId },
    });
  }

  async deleteVideo(tenantId: string, propertyId: string, videoId: string) {
    const video = await this.findVideo(tenantId, propertyId, videoId);
    if (!video) return null;
    await this.prisma.dbClient.property_videos.deleteMany({
      where: { id: videoId, property_id: propertyId, tenant_id: tenantId },
    });
    return video;
  }

  async addDocument(input: {
    tenantId: string;
    propertyId: string;
    name: string;
    url: string;
    storageKey?: string | null;
    docType?: string | null;
  }) {
    return this.prisma.dbClient.property_documents.create({
      data: {
        tenant_id: input.tenantId,
        property_id: input.propertyId,
        name: input.name,
        url: input.url,
        storage_key: input.storageKey ?? null,
        doc_type: input.docType ?? null,
      },
    });
  }

  async findDocument(tenantId: string, propertyId: string, documentId: string) {
    return this.prisma.dbClient.property_documents.findFirst({
      where: { id: documentId, property_id: propertyId, tenant_id: tenantId },
    });
  }

  async deleteDocument(tenantId: string, propertyId: string, documentId: string) {
    const doc = await this.findDocument(tenantId, propertyId, documentId);
    if (!doc) return null;
    await this.prisma.dbClient.property_documents.deleteMany({
      where: { id: documentId, property_id: propertyId, tenant_id: tenantId },
    });
    return doc;
  }

  // --- Public listing --------------------------------------------------------

  async listPublic(input: {
    tenantId: string;
    filters: PropertyListFilters;
    page: number;
    perPage: number;
  }) {
    const where: Prisma.propertiesWhereInput = this.tenantWhere(input.tenantId, {
      deleted_at: null,
      is_public: true,
      status: 'published',
      images: { some: {} }, // BR-P02: at least one image
    });
    const f = input.filters;
    if (f.type) where.type = f.type;
    if (f.category) where.category = f.category;
    if (f.requirementType) where.requirement_type = f.requirementType;
    if (f.city) where.city = { equals: f.city, mode: 'insensitive' };
    if (f.minPrice != null || f.maxPrice != null) {
      where.price = {
        ...(f.minPrice != null ? { gte: f.minPrice } : {}),
        ...(f.maxPrice != null ? { lte: f.maxPrice } : {}),
      };
    }
    const search = f.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.dbClient.properties.findMany({
        where,
        include: {
          images: { orderBy: [{ is_cover: 'desc' }, { sort_order: 'asc' }] },
          amenities: true,
          tags: true,
        },
        orderBy: { published_at: 'desc' },
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.dbClient.properties.count({ where }),
    ]);
    return { rows, total };
  }

  async findPublicBySlug(tenantId: string, slug: string) {
    return this.prisma.dbClient.properties.findFirst({
      where: {
        tenant_id: tenantId,
        slug,
        deleted_at: null,
        is_public: true,
        status: 'published',
      },
      include: {
        images: { orderBy: [{ is_cover: 'desc' }, { sort_order: 'asc' }] },
        videos: { orderBy: { sort_order: 'asc' } },
        amenities: true,
        tags: true,
      },
    });
  }

  async findOrganizationBySlug(slug: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { slug, deleted_at: null },
      select: { id: true, name: true, slug: true, status: true },
    });
  }
}
