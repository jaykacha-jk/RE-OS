import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import type { SettingsCategory } from './settings.constants';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Tenant settings -------------------------------------------------------

  async findCategory(tenantId: string, category: SettingsCategory) {
    return this.prisma.dbClient.tenant_settings.findUnique({
      where: { tenant_id_category: { tenant_id: tenantId, category } },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.dbClient.tenant_settings.findMany({
      where: { tenant_id: tenantId },
    });
  }

  async upsertCategory(input: {
    tenantId: string;
    category: SettingsCategory;
    data: Prisma.InputJsonValue;
    updatedBy?: string | null;
  }) {
    return this.prisma.dbClient.tenant_settings.upsert({
      where: { tenant_id_category: { tenant_id: input.tenantId, category: input.category } },
      update: { data: input.data, updated_by: input.updatedBy ?? null },
      create: {
        tenant_id: input.tenantId,
        category: input.category,
        data: input.data,
        updated_by: input.updatedBy ?? null,
      },
    });
  }

  async findOrganization(tenantId: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { id: tenantId, deleted_at: null },
      select: { id: true, name: true, slug: true, status: true, timezone: true },
    });
  }

  async findOrganizationBySlug(slug: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { slug, deleted_at: null },
      select: { id: true, name: true, slug: true, status: true },
    });
  }

  // --- Custom domains --------------------------------------------------------

  async listDomains(tenantId: string) {
    return this.prisma.dbClient.custom_domains.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
    });
  }

  async findDomainById(tenantId: string, id: string) {
    return this.prisma.dbClient.custom_domains.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
    });
  }

  async findDomainByHostname(domain: string) {
    return this.prisma.dbClient.custom_domains.findFirst({
      where: { domain, deleted_at: null },
    });
  }

  async createDomain(input: {
    tenantId: string;
    domain: string;
    isPrimary: boolean;
    verificationToken: string;
    dnsRecords: Prisma.InputJsonValue;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.custom_domains.updateMany({
          where: { tenant_id: input.tenantId, deleted_at: null },
          data: { is_primary: false },
        });
      }
      return tx.custom_domains.create({
        data: {
          tenant_id: input.tenantId,
          domain: input.domain,
          is_primary: input.isPrimary,
          verification_token: input.verificationToken,
          dns_records: input.dnsRecords,
        },
      });
    });
  }

  async updateDomain(input: {
    tenantId: string;
    id: string;
    isPrimary?: boolean;
    sslStatus?: string;
    verificationStatus?: string;
    verifiedAt?: Date | null;
    lastCheckedAt?: Date | null;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.custom_domains.updateMany({
          where: { tenant_id: input.tenantId, deleted_at: null, id: { not: input.id } },
          data: { is_primary: false },
        });
      }
      return tx.custom_domains.update({
        where: { id: input.id },
        data: {
          ...(input.isPrimary !== undefined ? { is_primary: input.isPrimary } : {}),
          ...(input.sslStatus !== undefined ? { ssl_status: input.sslStatus } : {}),
          ...(input.verificationStatus !== undefined
            ? { verification_status: input.verificationStatus }
            : {}),
          ...(input.verifiedAt !== undefined ? { verified_at: input.verifiedAt } : {}),
          ...(input.lastCheckedAt !== undefined ? { last_checked_at: input.lastCheckedAt } : {}),
        },
      });
    });
  }

  async softDeleteDomain(tenantId: string, id: string) {
    const existing = await this.findDomainById(tenantId, id);
    if (!existing) return null;
    return this.prisma.dbClient.custom_domains.update({
      where: { id },
      data: { deleted_at: new Date(), is_primary: false },
    });
  }
}
