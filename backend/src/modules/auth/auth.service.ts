import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { importPKCS8, SignJWT } from 'jose';
import { createHash, randomBytes } from 'crypto';

import { AuthRepository } from './auth.repository';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import bcrypt from 'bcrypt';
import type { AuthUser } from '../../common/context/auth-user';
import { getJwtPrivateKeyPem } from '../../config/jwt-keys';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 7;
const PASSWORD_RESET_TTL_MINUTES = 30;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly auditService: AuditService,
  ) {}

  private async signAccessToken(input: {
    userId: string;
    tenantId: string | null;
    roles: string[];
    permissions: string[];
  }) {
    const privateKeyPem = getJwtPrivateKeyPem();
    if (!privateKeyPem) {
      throw new UnauthorizedException('JWT_PRIVATE_KEY not configured');
    }

    const privateKey = await importPKCS8(privateKeyPem, 'RS256');
    const jti = randomBytes(16).toString('hex');

    return new SignJWT({
      tid: input.tenantId,
      roles: input.roles,
      permissions: input.permissions,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(input.userId)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(privateKey);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private devTokenHint(name: string, token: string, path: string) {
    if (process.env.NODE_ENV === 'production') return {};
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return {
      [name]: token,
      url: `${base}${path}?token=${encodeURIComponent(token)}`,
    };
  }

  async login(dto: LoginDto, meta?: AuditRequestMeta) {
    const tenantId = dto.tenant_slug
      ? (await this.authRepository.findOrganizationBySlug(dto.tenant_slug))?.id ?? null
      : null;

    if (dto.tenant_slug && !tenantId) {
      throw new UnauthorizedException('Invalid tenant_slug');
    }

    // Phase 1 currently requires tenant-scoped users (super-admin platform roles will be expanded later).
    const userTenantId = tenantId;
    const user = await this.authRepository.findUserByEmail(dto.email, userTenantId);
    if (!user || !user.password_hash) {
      await this.auditService.record({
        tenantId: userTenantId,
        actorEmail: dto.email,
        action: 'auth.login.failed',
        entityType: 'user',
        meta,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      await this.auditService.record({
        tenantId: userTenantId,
        actorEmail: dto.email,
        action: 'auth.login.locked',
        entityType: 'user',
        entityId: user.id,
        meta,
      });
      throw new ForbiddenException('BUSINESS_RULE_VIOLATION: BR-A03 Account is temporarily locked');
    }

    if (dto.tenant_slug) {
      const org = await this.authRepository.findOrganizationBySlug(dto.tenant_slug);
      if (org?.status === 'suspended') {
        throw new ForbiddenException('Organization is suspended');
      }
    }

    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) {
      const failedCount = user.failed_login_count + 1;
      const lockedUntil =
        failedCount >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null;
      await this.authRepository.updateLoginFailure(user.id, failedCount, lockedUntil);
      await this.auditService.record({
        tenantId: userTenantId,
        actorEmail: dto.email,
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: user.id,
        meta,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authRepository.resetLoginFailures(user.id);

    const { roles, permissions } = await this.authRepository.getRolesAndPermissions(
      user.id,
      userTenantId,
    );

    const access_token = await this.signAccessToken({
      userId: user.id,
      tenantId: userTenantId,
      roles,
      permissions,
    });

    const refresh_token_raw = randomBytes(32).toString('base64url');
    const refresh_token_hash = this.hashToken(refresh_token_raw);
    const refresh_jti = randomBytes(12).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      jti: refresh_jti,
      tokenHash: refresh_token_hash,
      expiresAt,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
    });

    await this.auditService.record({
      actor: { userId: user.id, tenantId: userTenantId },
      action: 'auth.login.succeeded',
      entityType: 'user',
      entityId: user.id,
      afterState: { roles, tenant_id: userTenantId },
      meta,
    });

    return {
      access_token,
      refresh_token: refresh_token_raw,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name ?? null,
        roles,
        tenant_id: userTenantId,
        permissions,
      },
    };
  }

  async refresh(dto: RefreshDto, meta?: AuditRequestMeta) {
    const tokenHash = this.hashToken(dto.refresh_token);
    const existing = await this.authRepository.findRefreshTokenByHash(tokenHash);
    if (!existing || existing.revoked_at || existing.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.authRepository.revokeRefreshToken(tokenHash, new Date());

    // Load user + tenant-scoped roles.
    const user = await this.authRepository.findUserById(existing.user_id);
    if (!user) throw new UnauthorizedException('Invalid refresh token');

    const tenantId = user.tenant_id ?? null;
    const { roles, permissions } = await this.authRepository.getRolesAndPermissions(
      user.id,
      tenantId,
    );

    const access_token = await this.signAccessToken({
      userId: user.id,
      tenantId,
      roles,
      permissions,
    });

    const refresh_token_raw = randomBytes(32).toString('base64url');
    const refresh_token_hash = this.hashToken(refresh_token_raw);
    const refresh_jti = randomBytes(12).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      jti: refresh_jti,
      tokenHash: refresh_token_hash,
      expiresAt,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
    });

    await this.auditService.record({
      actor: { userId: user.id, tenantId },
      action: 'auth.refresh.succeeded',
      entityType: 'refresh_token',
      entityId: existing.id,
      meta,
    });

    return {
      access_token,
      refresh_token: refresh_token_raw,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name ?? null,
        roles,
        tenant_id: tenantId,
        permissions,
      },
    };
  }

  async logout(dto: RefreshDto, meta?: AuditRequestMeta) {
    const tokenHash = this.hashToken(dto.refresh_token);
    const existing = await this.authRepository.findRefreshTokenByHash(tokenHash);
    const now = new Date();
    await this.authRepository.revokeRefreshToken(tokenHash, now);

    if (existing) {
      const user = await this.authRepository.findUserById(existing.user_id);
      await this.auditService.record({
        actor: user ? { userId: user.id, tenantId: user.tenant_id ?? null } : null,
        action: 'auth.logout',
        entityType: 'refresh_token',
        entityId: existing.id,
        meta,
      });
    }
  }

  async me(user: AuthUser) {
    return {
      user_id: user.userId,
      tenant_id: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto, meta?: AuditRequestMeta) {
    const tokenHash = this.hashToken(dto.token);
    const invitation = await this.authRepository.findInvitationByTokenHash(tokenHash);

    if (!invitation || invitation.accepted_at || invitation.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired invitation');
    }

    const user = await this.authRepository.findInvitedUser(invitation.email, invitation.role_id);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired invitation');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.authRepository.activateInvitedUser(user.id, passwordHash);
    await this.authRepository.markInvitationAccepted(tokenHash);

    const tenantId = user.tenant_id ?? null;
    const { roles, permissions } = await this.authRepository.getRolesAndPermissions(
      user.id,
      tenantId,
    );

    const access_token = await this.signAccessToken({
      userId: user.id,
      tenantId,
      roles,
      permissions,
    });

    const refresh_token_raw = randomBytes(32).toString('base64url');
    const refresh_token_hash = this.hashToken(refresh_token_raw);
    const refresh_jti = randomBytes(12).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      jti: refresh_jti,
      tokenHash: refresh_token_hash,
      expiresAt,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
    });

    await this.auditService.record({
      actor: { userId: user.id, tenantId },
      action: 'auth.invitation.accepted',
      entityType: 'user_invitation',
      entityId: invitation.id,
      afterState: { email: user.email, role_id: invitation.role_id },
      meta,
    });

    return {
      access_token,
      refresh_token: refresh_token_raw,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name ?? null,
        roles,
        tenant_id: tenantId,
        permissions,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto, meta?: AuditRequestMeta) {
    const tenantId = dto.tenant_slug
      ? (await this.authRepository.findOrganizationBySlug(dto.tenant_slug))?.id ?? null
      : null;
    const user = await this.authRepository.findUserByEmail(dto.email, tenantId);
    let devHint = {};

    if (user) {
      const resetToken = randomBytes(32).toString('base64url');
      const tokenHash = this.hashToken(resetToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
      await this.authRepository.createPasswordResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      });
      devHint = this.devTokenHint('reset_token', resetToken, '/reset-password');
    }

    await this.auditService.record({
      actorEmail: dto.email,
      action: 'auth.password_reset.requested',
      entityType: 'user',
      afterState: { tenant_slug: dto.tenant_slug ?? null },
      meta,
    });
    // Phase 1: no email dispatch — always return success (no enumeration).
    return {
      message: 'If an account exists, password reset instructions have been sent.',
      ...devHint,
    };
  }

  async resetPassword(dto: ResetPasswordDto, meta?: AuditRequestMeta) {
    const tokenHash = this.hashToken(dto.token);
    const existing = await this.authRepository.findPasswordResetToken(tokenHash);
    if (!existing || existing.used_at || existing.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const consumed = await this.authRepository.consumePasswordResetToken(tokenHash, passwordHash);
    if (!consumed) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    await this.auditService.record({
      actor: { userId: consumed.user.id, tenantId: consumed.user.tenant_id ?? null },
      action: 'auth.password_reset.completed',
      entityType: 'user',
      entityId: consumed.user.id,
      meta,
    });

    return { message: 'Password has been reset. You can now sign in.' };
  }
}

