import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { importPKCS8, SignJWT } from 'jose';
import { createHash, randomBytes } from 'crypto';

import { AuthRepository } from './auth.repository';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

import bcrypt from 'bcrypt';
import type { AuthUser } from '../../common/context/auth-user';
import { getJwtPrivateKeyPem } from '../../config/jwt-keys';
import { QUEUES } from '../../jobs/queue.constants';
import { QueueService } from '../../jobs/queue.service';
import { AuditService, type AuditRequestMeta } from '../audit/audit.service';
import { EMAIL_JOB, type EmailJobData } from '../notifications/notifications.types';
import { FeatureFlagsService } from '../settings/feature-flags.service';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 7;
const PASSWORD_RESET_TTL_MINUTES = 30;
const EMAIL_VERIFICATION_TTL_HOURS = 24;
const TRIAL_DAYS = 14;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const DEFAULT_LEAD_SOURCES = [
  { name: 'Website', code: 'website' },
  { name: 'Property Portal', code: 'property_portal' },
  { name: 'WhatsApp', code: 'whatsapp' },
  { name: 'Facebook', code: 'facebook' },
  { name: 'Google Ads', code: 'google_ads' },
  { name: 'Referral', code: 'referral' },
  { name: 'Walk-in', code: 'walk_in' },
];

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly auditService: AuditService,
    private readonly queue: QueueService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private async withFeatureFlags<T extends { user?: { tenant_id?: string | null } }>(payload: T) {
    const tenantId = payload.user?.tenant_id;
    if (!tenantId) return payload;
    const feature_flags = await this.featureFlags.getFlags(tenantId);
    if (!payload.user) return payload;
    return {
      ...payload,
      user: {
        ...payload.user,
        feature_flags,
      },
    };
  }

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

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63);
  }

  private splitName(fullName: string): { firstName: string; lastName: string | null } {
    const parts = fullName.trim().replace(/\s+/g, ' ').split(' ');
    const firstName = parts.shift() ?? fullName.trim();
    const lastName = parts.length > 0 ? parts.join(' ') : null;
    return { firstName, lastName };
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
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

    if (
      userTenantId &&
      !user.email_verified_at &&
      (await this.authRepository.hasPendingEmailVerification(user.id))
    ) {
      await this.auditService.record({
        tenantId: userTenantId,
        actorEmail: dto.email,
        action: 'auth.login.email_unverified',
        entityType: 'user',
        entityId: user.id,
        meta,
      });
      throw new ForbiddenException('Email verification required before login');
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
    const refresh_family_id = randomBytes(12).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      jti: refresh_jti,
      tokenFamilyId: refresh_family_id,
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

    return this.withFeatureFlags({
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
    });
  }

  async register(dto: RegisterDto, meta?: AuditRequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const agencyName = dto.agency_name.trim().replace(/\s+/g, ' ');
    const ownerName = dto.owner_name.trim().replace(/\s+/g, ' ');
    const slug = dto.agency_slug?.trim() ?? this.slugify(agencyName);

    if (!slug || slug.length < 3) {
      throw new ConflictException('Agency name cannot produce a valid organization slug');
    }

    const [existingOrgBySlug, existingOrgByName, existingUser] = await Promise.all([
      this.authRepository.findOrganizationBySlug(slug),
      this.authRepository.findOrganizationByName(agencyName),
      this.authRepository.findAnyUserByEmail(email),
    ]);

    if (existingOrgBySlug || existingOrgByName) {
      throw new ConflictException('Organization already exists');
    }
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const [ownerRole, starterPlan] = await Promise.all([
      this.authRepository.findRoleByCode('org_owner'),
      this.authRepository.findActivePlanByCode('starter'),
    ]);
    if (!ownerRole) throw new NotFoundException('org_owner role is not seeded');
    if (!starterPlan) throw new NotFoundException('starter plan is not seeded');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const verificationToken = randomBytes(32).toString('base64url');
    const verificationTokenHash = this.hashToken(verificationToken);
    const now = new Date();
    const verificationExpiresAt = this.addHours(now, EMAIL_VERIFICATION_TTL_HOURS);
    const trialEndsAt = this.addDays(now, TRIAL_DAYS);
    const { firstName, lastName } = this.splitName(ownerName);

    const created = await this.authRepository.createRegisteredOrganization({
      agencyName,
      slug,
      ownerEmail: email,
      ownerPhone: dto.phone,
      ownerFirstName: firstName,
      ownerLastName: lastName,
      passwordHash,
      ownerRoleId: ownerRole.id,
      planId: starterPlan.id,
      verificationTokenHash,
      verificationExpiresAt,
      trialEndsAt,
      leadSources: DEFAULT_LEAD_SOURCES,
    });

    await this.auditService.record({
      actor: { userId: created.user.id, tenantId: created.organization.id },
      tenantId: created.organization.id,
      action: 'auth.register.completed',
      entityType: 'organization',
      entityId: created.organization.id,
      afterState: {
        organization_slug: created.organization.slug,
        owner_email: created.user.email,
        plan_code: created.subscription.plan.code,
        trial_ends_at: created.subscription.trial_ends_at?.toISOString() ?? null,
      },
      meta,
    });

    await this.enqueueVerificationEmail({
      userId: created.user.id,
      tenantId: created.organization.id,
      organizationName: created.organization.name,
      token: verificationToken,
      expiresAt: verificationExpiresAt,
    });

    return {
      organization: {
        id: created.organization.id,
        name: created.organization.name,
        slug: created.organization.slug,
        status: created.organization.status,
        tier: created.organization.tier,
        trial_ends_at: created.subscription.trial_ends_at?.toISOString() ?? null,
      },
      owner: {
        id: created.user.id,
        email: created.user.email,
        first_name: created.user.first_name,
        last_name: created.user.last_name,
        email_verified_at: created.user.email_verified_at?.toISOString() ?? null,
      },
      subscription: {
        id: created.subscription.id,
        status: created.subscription.status,
        plan_code: created.subscription.plan.code,
        billing_cycle: created.subscription.billing_cycle,
        trial_ends_at: created.subscription.trial_ends_at?.toISOString() ?? null,
      },
      verification_email_sent: true,
      ...this.devTokenHint(
        'verification_token',
        verificationToken,
        '/verify-email',
      ),
    };
  }

  async refresh(refreshToken: string, meta?: AuditRequestMeta) {
    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.authRepository.findRefreshTokenByHash(tokenHash);
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    if (existing.revoked_at) {
      const user = await this.authRepository.findUserById(existing.user_id);
      await this.authRepository.revokeRefreshTokenFamily(
        existing.user_id,
        existing.token_family_id,
        now,
      );
      await this.auditService.record({
        actor: user ? { userId: user.id, tenantId: user.tenant_id ?? null } : null,
        tenantId: user?.tenant_id ?? null,
        action: 'auth.refresh.reuse_detected',
        entityType: 'refresh_token',
        entityId: existing.id,
        afterState: {
          token_family_id: existing.token_family_id,
          reused_jti: existing.jti,
        },
        meta,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.authRepository.revokeRefreshToken(tokenHash, now);

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
      tokenFamilyId: existing.token_family_id,
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

    return this.withFeatureFlags({
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
    });
  }

  async logout(refreshToken: string | undefined, meta?: AuditRequestMeta) {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
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
    const current = await this.authRepository.findActiveUserById(user.userId);
    if (!current) throw new NotFoundException('User not found');
    const feature_flags = user.tenantId
      ? await this.featureFlags.getFlags(user.tenantId)
      : {};
    return {
      user_id: user.userId,
      tenant_id: user.tenantId,
      email: current.email,
      first_name: current.first_name,
      last_name: current.last_name,
      phone: current.phone,
      roles: user.roles,
      permissions: user.permissions,
      feature_flags,
    };
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto, meta?: AuditRequestMeta) {
    const updated = await this.authRepository.updateProfile(user.userId, {
      firstName: dto.first_name?.trim(),
      lastName:
        dto.last_name === undefined
          ? undefined
          : dto.last_name?.trim() || null,
      phone:
        dto.phone === undefined
          ? undefined
          : dto.phone?.trim() || null,
    });
    if (!updated) throw new NotFoundException('User not found');

    await this.auditService.record({
      actor: user,
      tenantId: user.tenantId,
      action: 'auth.profile.updated',
      entityType: 'user',
      entityId: user.userId,
      afterState: {
        first_name: updated.first_name,
        last_name: updated.last_name,
        phone: updated.phone,
      },
      meta,
    });

    return {
      user_id: user.userId,
      tenant_id: user.tenantId,
      email: updated.email,
      first_name: updated.first_name,
      last_name: updated.last_name,
      phone: updated.phone,
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

    const user = await this.authRepository.findInvitedUser(
      invitation.tenant_id,
      invitation.user_id,
      invitation.email,
      invitation.role_id,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid or expired invitation');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const activatedUser = await this.authRepository.activateInvitedUser(
      invitation.tenant_id,
      user.id,
      passwordHash,
    );
    if (!activatedUser) {
      throw new UnauthorizedException('Invalid or expired invitation');
    }
    await this.authRepository.markInvitationAccepted(tokenHash, invitation.tenant_id, user.id);

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
    const refresh_family_id = randomBytes(12).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      jti: refresh_jti,
      tokenFamilyId: refresh_family_id,
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

    return this.withFeatureFlags({
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
    });
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
      await this.enqueuePasswordResetEmail({
        userId: user.id,
        tenantId: user.tenant_id ?? tenantId,
        token: resetToken,
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

  async verifyEmail(dto: VerifyEmailDto, meta?: AuditRequestMeta) {
    const tokenHash = this.hashToken(dto.token);
    const result = await this.authRepository.consumeEmailVerificationToken(tokenHash);

    if (!result) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await this.auditService.record({
      actor: { userId: result.user.id, tenantId: result.user.tenant_id ?? null },
      tenantId: result.user.tenant_id ?? null,
      action: 'auth.email.verified',
      entityType: 'user',
      entityId: result.user.id,
      afterState: {
        email: result.user.email,
        tenant_slug: result.user.tenant?.slug ?? null,
      },
      meta,
    });

    return {
      message: 'Email verified. You can now sign in.',
      user: {
        id: result.user.id,
        email: result.user.email,
        email_verified_at: result.user.email_verified_at?.toISOString() ?? null,
      },
      organization: result.user.tenant
        ? {
            id: result.user.tenant.id,
            name: result.user.tenant.name,
            slug: result.user.tenant.slug,
          }
        : null,
    };
  }

  private async enqueuePasswordResetEmail(input: {
    userId: string;
    tenantId: string | null;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const resetUrl = this.buildAppUrl(
      `/reset-password?token=${encodeURIComponent(input.token)}`,
    );
    await this.queue.enqueue<EmailJobData>(QUEUES.EMAIL, EMAIL_JOB, {
      tenantId: input.tenantId,
      userId: input.userId,
      eventKey: 'auth.password_reset.requested',
      context: {
        resetUrl,
        expiresAt: input.expiresAt.toISOString(),
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      },
      subject: 'Reset your RE-OS password',
      body: [
        'We received a request to reset your RE-OS password.',
        '',
        `Reset your password: ${resetUrl}`,
        '',
        `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
      ].join('\n'),
      html: [
        '<p>We received a request to reset your RE-OS password.</p>',
        `<p><a href="${resetUrl}">Reset your password</a></p>`,
        `<p>This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.</p>`,
      ].join(''),
    });
  }

  private async enqueueVerificationEmail(input: {
    userId: string;
    tenantId: string;
    organizationName: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const verifyUrl = this.buildAppUrl(
      `/verify-email?token=${encodeURIComponent(input.token)}`,
    );
    const organizationNameHtml = this.escapeHtml(input.organizationName);
    await this.queue.enqueue<EmailJobData>(QUEUES.EMAIL, EMAIL_JOB, {
      tenantId: input.tenantId,
      userId: input.userId,
      eventKey: 'auth.email_verification.requested',
      context: {
        organizationName: input.organizationName,
        verifyUrl,
        expiresAt: input.expiresAt.toISOString(),
        expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
      },
      subject: 'Verify your RE-OS email',
      body: [
        `Welcome to RE-OS. Verify your email to activate ${input.organizationName}.`,
        '',
        `Verify email: ${verifyUrl}`,
        '',
        `This link expires in ${EMAIL_VERIFICATION_TTL_HOURS} hours.`,
      ].join('\n'),
      html: [
        `<p>Welcome to RE-OS. Verify your email to activate ${organizationNameHtml}.</p>`,
        `<p><a href="${verifyUrl}">Verify email</a></p>`,
        `<p>This link expires in ${EMAIL_VERIFICATION_TTL_HOURS} hours.</p>`,
      ].join(''),
    });
  }

  private buildAppUrl(path: string): string {
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}${path}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

