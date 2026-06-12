import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class PlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrganizationBySlug(slug: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { slug, deleted_at: null },
    });
  }

  async findOrganizationById(id: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: { id, deleted_at: null },
      include: { organization_usage: true },
    });
  }

  async listOrganizations(input: {
    status?: string;
    tier?: string;
    page: number;
    perPage: number;
  }) {
    const where = {
      deleted_at: null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.tier ? { tier: input.tier } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.dbClient.organizations.findMany({
        where,
        include: { organization_usage: true },
        orderBy: { created_at: 'desc' },
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.dbClient.organizations.count({ where }),
    ]);

    return { rows, total };
  }

  async createOrganization(input: {
    name: string;
    slug: string;
    tier: string;
    billing_email: string;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const org = await tx.organizations.create({
        data: {
          name: input.name,
          slug: input.slug,
          billing_email: input.billing_email,
          status: 'trial',
          tier: input.tier,
        },
      });

      await tx.organization_usage.create({
        data: { tenant_id: org.id },
      });

      return org;
    });
  }

  async updateOrganization(
    id: string,
    data: { status?: string; tier?: string; billing_email?: string; name?: string },
  ) {
    return this.prisma.dbClient.organizations.update({
      where: { id },
      data,
      include: { organization_usage: true },
    });
  }

  async findRoleByCode(code: string) {
    return this.prisma.dbClient.roles.findFirst({
      where: { tenant_id: null, code, deleted_at: null },
    });
  }

  async findUserByEmailInTenant(email: string, tenantId: string) {
    return this.prisma.dbClient.users.findFirst({
      where: { email, tenant_id: tenantId, deleted_at: null },
    });
  }

  async createOwnerInvitation(input: {
    tenantId: string;
    email: string;
    roleId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          tenant_id: input.tenantId,
          email: input.email,
          user_type: 'internal',
          status: 'invited',
        },
      });

      await tx.user_roles.create({
        data: {
          user_id: user.id,
          role_id: input.roleId,
          tenant_id: input.tenantId,
        },
      });

      await tx.user_invitations.create({
        data: {
          email: input.email,
          role_id: input.roleId,
          token_hash: input.tokenHash,
          expires_at: input.expiresAt,
        },
      });

      return user;
    });
  }
}
