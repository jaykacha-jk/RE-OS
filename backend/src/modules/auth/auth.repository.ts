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
      const superAdminRole = await this.prisma.dbClient.roles.findFirst({
        where: { tenant_id: null, code: 'super_admin', deleted_at: null },
        include: {
          role_permissions: { include: { permissions: true } },
        },
      });

      const permissions =
        superAdminRole?.role_permissions.map((rp) => rp.permissions.code) ?? [];

      return { roles: ['super_admin'], permissions };
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

  async createRefreshToken(input: {
    userId: string;
    jti: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }) {
    return this.prisma.dbClient.refresh_tokens.create({
      data: {
        user_id: input.userId,
        jti: input.jti,
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

  async findInvitationByTokenHash(tokenHash: string) {
    return this.prisma.dbClient.user_invitations.findUnique({
      where: { token_hash: tokenHash },
      include: { roles: true },
    });
  }

  async findInvitedUser(email: string, roleId: string) {
    return this.prisma.dbClient.users.findFirst({
      where: {
        email,
        status: 'invited',
        deleted_at: null,
        user_roles: { some: { role_id: roleId } },
      },
    });
  }

  async activateInvitedUser(userId: string, passwordHash: string) {
    return this.prisma.dbClient.users.update({
      where: { id: userId },
      data: {
        password_hash: passwordHash,
        status: 'active',
        email_verified_at: new Date(),
      },
    });
  }

  async markInvitationAccepted(tokenHash: string) {
    return this.prisma.dbClient.user_invitations.update({
      where: { token_hash: tokenHash },
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

