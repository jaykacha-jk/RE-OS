import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrganizationBySlug(slug: string) {
    return this.prisma.dbClient.organizations.findUnique({
      where: { slug },
    });
  }

  async findUserByEmail(email: string, tenantId: string | null) {
    return this.prisma.dbClient.users.findFirst({
      where: {
        email,
        tenant_id: tenantId,
        deleted_at: null,
        status: { in: ['active', 'invited'] },
      },
    });
  }

  async findAnyUserByEmail(email: string) {
    return this.prisma.dbClient.users.findFirst({
      where: {
        email,
        deleted_at: null,
      },
    });
  }

  async findOrganizationByName(name: string) {
    return this.prisma.dbClient.organizations.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        deleted_at: null,
      },
    });
  }

  async findRoleByCode(code: string) {
    return this.prisma.dbClient.roles.findFirst({
      where: { tenant_id: null, code, deleted_at: null },
    });
  }

  async findActivePlanByCode(code: string) {
    return this.prisma.dbClient.subscription_plans.findFirst({
      where: { code, is_active: true },
    });
  }

  async updateLoginFailure(userId: string, failedLoginCount: number, lockedUntil?: Date | null) {
    return this.prisma.dbClient.users.update({
      where: { id: userId },
      data: {
        failed_login_count: failedLoginCount,
        locked_until: lockedUntil,
      },
    });
  }

  async resetLoginFailures(userId: string) {
    return this.prisma.dbClient.users.update({
      where: { id: userId },
      data: {
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date(),
      },
    });
  }

  async getRolesAndPermissions(userId: string, tenantId: string | null) {
    if (!tenantId) {
      const platformUser = await this.prisma.dbClient.users.findFirst({
        where: {
          id: userId,
          tenant_id: null,
          user_type: 'super_admin',
          deleted_at: null,
        },
      });
      if (!platformUser) return { roles: [], permissions: [] };

      const superAdminRole = await this.prisma.dbClient.roles.findFirst({
        where: { tenant_id: null, code: 'super_admin', deleted_at: null },
        include: {
          role_permissions: { include: { permissions: true } },
        },
      });

      const permissions =
        superAdminRole?.role_permissions.map((rp) => rp.permissions.code) ?? [];

      return { roles: superAdminRole ? ['super_admin'] : [], permissions };
    }

    const userRoles = await this.prisma.dbClient.user_roles.findMany({
      where: { user_id: userId, tenant_id: tenantId },
      include: {
        role: {
          include: {
            role_permissions: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    const roles = userRoles.map((ur) => ur.role.code);
    const permissions = userRoles.flatMap((ur) =>
      ur.role.role_permissions.map((rp) => rp.permissions.code),
    );
    return { roles, permissions };
  }

  async findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.dbClient.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
    });
  }

  async findUserById(userId: string) {
    return this.prisma.dbClient.users.findUnique({
      where: { id: userId },
    });
  }

  async findActiveUserById(userId: string) {
    return this.prisma.dbClient.users.findFirst({
      where: { id: userId, deleted_at: null },
    });
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string | null; phone?: string | null },
  ) {
    const result = await this.prisma.dbClient.users.updateMany({
      where: { id: userId, deleted_at: null },
      data: {
        ...(data.firstName !== undefined ? { first_name: data.firstName } : {}),
        ...(data.lastName !== undefined ? { last_name: data.lastName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
    });
    if (result.count !== 1) return null;
    return this.findActiveUserById(userId);
  }

  async createRefreshToken(input: {
    userId: string;
    jti: string;
    tokenFamilyId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }) {
    return this.prisma.dbClient.refresh_tokens.create({
      data: {
        user_id: input.userId,
        jti: input.jti,
        token_family_id: input.tokenFamilyId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
        user_agent: input.userAgent,
        ip_address: input.ipAddress,
      },
    });
  }

  async revokeRefreshToken(tokenHash: string, revokedAt: Date) {
    return this.prisma.dbClient.refresh_tokens.updateMany({
      where: { token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: revokedAt },
    });
  }

  async revokeRefreshTokenFamily(userId: string, tokenFamilyId: string, revokedAt: Date) {
    return this.prisma.dbClient.refresh_tokens.updateMany({
      where: {
        user_id: userId,
        token_family_id: tokenFamilyId,
        revoked_at: null,
      },
      data: { revoked_at: revokedAt },
    });
  }

  async findInvitationByTokenHash(tokenHash: string) {
    return this.prisma.dbClient.user_invitations.findUnique({
      where: { token_hash: tokenHash },
      include: { roles: true },
    });
  }

  async findInvitedUser(tenantId: string, userId: string, email: string, roleId: string) {
    return this.prisma.dbClient.users.findFirst({
      where: {
        id: userId,
        tenant_id: tenantId,
        email,
        status: 'invited',
        deleted_at: null,
        user_roles: { some: { tenant_id: tenantId, role_id: roleId } },
      },
    });
  }

  async activateInvitedUser(tenantId: string, userId: string, passwordHash: string) {
    const result = await this.prisma.dbClient.users.updateMany({
      where: { id: userId, tenant_id: tenantId, status: 'invited', deleted_at: null },
      data: {
        password_hash: passwordHash,
        status: 'active',
        email_verified_at: new Date(),
      },
    });
    if (result.count !== 1) return null;
    return this.prisma.dbClient.users.findFirst({
      where: { id: userId, tenant_id: tenantId, deleted_at: null },
    });
  }

  async markInvitationAccepted(tokenHash: string, tenantId: string, userId: string) {
    return this.prisma.dbClient.user_invitations.updateMany({
      where: { token_hash: tokenHash, tenant_id: tenantId, user_id: userId },
      data: { accepted_at: new Date() },
    });
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.dbClient.password_reset_tokens.create({
      data: {
        user_id: input.userId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
      },
    });
  }

  async createRegisteredOrganization(input: {
    agencyName: string;
    slug: string;
    ownerEmail: string;
    ownerPhone: string;
    ownerFirstName: string;
    ownerLastName: string | null;
    passwordHash: string;
    ownerRoleId: string;
    planId: string;
    verificationTokenHash: string;
    verificationExpiresAt: Date;
    trialEndsAt: Date;
    leadSources: { name: string; code: string }[];
  }) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const organization = await tx.organizations.create({
        data: {
          name: input.agencyName,
          slug: input.slug,
          billing_email: input.ownerEmail,
          status: 'trial',
          tier: 'starter',
        },
      });

      const user = await tx.users.create({
        data: {
          tenant_id: organization.id,
          email: input.ownerEmail,
          phone: input.ownerPhone,
          password_hash: input.passwordHash,
          first_name: input.ownerFirstName,
          last_name: input.ownerLastName,
          user_type: 'internal',
          status: 'active',
        },
      });

      const employee = await tx.employees.create({
        data: {
          tenant_id: organization.id,
          user_id: user.id,
          department: 'Leadership',
          status: 'active',
          joined_at: new Date(),
        },
      });

      await tx.user_roles.create({
        data: {
          user_id: user.id,
          role_id: input.ownerRoleId,
          tenant_id: organization.id,
        },
      });

      await tx.organization_usage.create({
        data: {
          tenant_id: organization.id,
          employees_count: 1,
        },
      });

      await tx.lead_sources.createMany({
        data: input.leadSources.map((source) => ({
          tenant_id: organization.id,
          name: source.name,
          code: source.code,
          is_active: true,
          is_system: true,
          created_by: user.id,
        })),
      });

      const now = new Date();
      const subscription = await tx.subscriptions.create({
        data: {
          tenant_id: organization.id,
          plan_id: input.planId,
          status: 'trial',
          billing_cycle: 'monthly',
          provider: 'trial',
          current_period_start: now,
          current_period_end: input.trialEndsAt,
          trial_ends_at: input.trialEndsAt,
          created_by: user.id,
          updated_by: user.id,
        },
        include: { plan: true },
      });

      await tx.email_verification_tokens.create({
        data: {
          user_id: user.id,
          token_hash: input.verificationTokenHash,
          expires_at: input.verificationExpiresAt,
        },
      });

      return { organization, user, employee, subscription };
    });
  }

  async hasPendingEmailVerification(userId: string) {
    const count = await this.prisma.dbClient.email_verification_tokens.count({
      where: {
        user_id: userId,
        used_at: null,
      },
    });
    return count > 0;
  }

  async consumeEmailVerificationToken(tokenHash: string) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const token = await tx.email_verification_tokens.findUnique({
        where: { token_hash: tokenHash },
        include: { user: { include: { tenant: true } } },
      });
      if (!token || token.used_at || token.expires_at.getTime() < Date.now()) return null;

      await tx.email_verification_tokens.update({
        where: { token_hash: tokenHash },
        data: { used_at: new Date() },
      });

      const user = await tx.users.update({
        where: { id: token.user_id },
        data: {
          email_verified_at: token.user.email_verified_at ?? new Date(),
        },
        include: { tenant: true },
      });

      return { token, user };
    });
  }

  async findPasswordResetToken(tokenHash: string) {
    return this.prisma.dbClient.password_reset_tokens.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });
  }

  async consumePasswordResetToken(tokenHash: string, passwordHash: string) {
    return this.prisma.dbClient.$transaction(async (tx) => {
      const token = await tx.password_reset_tokens.findUnique({
        where: { token_hash: tokenHash },
        include: { user: true },
      });
      if (!token || token.used_at || token.expires_at.getTime() < Date.now()) return null;

      const updatedUser = await tx.users.update({
        where: { id: token.user_id },
        data: {
          password_hash: passwordHash,
          failed_login_count: 0,
          locked_until: null,
          status: token.user.status === 'invited' ? 'active' : token.user.status,
        },
      });

      await tx.password_reset_tokens.update({
        where: { token_hash: tokenHash },
        data: { used_at: new Date() },
      });

      return { token, user: updatedUser };
    });
  }
}

