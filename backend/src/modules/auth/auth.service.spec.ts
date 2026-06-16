import bcrypt from 'bcrypt';

import { QUEUES } from '../../jobs/queue.constants';
import { EMAIL_JOB } from '../notifications/notifications.types';
import { AuthService } from './auth.service';

describe('AuthService password reset email dispatch', () => {
  const originalEnv = process.env;

  const buildService = () => {
    const authRepository = {
      findUserByEmail: jest.fn(),
      findOrganizationBySlug: jest.fn(),
      findOrganizationByName: jest.fn(),
      findAnyUserByEmail: jest.fn(),
      findRoleByCode: jest.fn(),
      findActivePlanByCode: jest.fn(),
      createRegisteredOrganization: jest.fn(),
      findRefreshTokenByHash: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeRefreshTokenFamily: jest.fn(),
      createRefreshToken: jest.fn(),
      findUserById: jest.fn(),
      findActiveUserById: jest.fn(),
      updateProfile: jest.fn(),
      getRolesAndPermissions: jest.fn(),
      createPasswordResetToken: jest.fn(),
      hasPendingEmailVerification: jest.fn(),
      consumeEmailVerificationToken: jest.fn(),
      updateLoginFailure: jest.fn(),
    };
    const auditService = { record: jest.fn() };
    const queue = { enqueue: jest.fn() };
    const featureFlags = { getFlags: jest.fn().mockResolvedValue({}) };
    const service = new AuthService(
      authRepository as never,
      auditService as never,
      queue as never,
      featureFlags as never,
    );
    return { service, authRepository, auditService, queue };
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      APP_URL: 'https://app.example.com',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('queues a reset email for an existing user without changing the public response', async () => {
    const { service, authRepository, queue } = buildService();
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user_1',
      email: 'owner@example.com',
      tenant_id: 'tenant_1',
    });
    authRepository.createPasswordResetToken.mockResolvedValue({});

    const result = await service.forgotPassword({ email: 'owner@example.com' });

    expect(queue.enqueue).toHaveBeenCalledWith(
      QUEUES.EMAIL,
      EMAIL_JOB,
      expect.objectContaining({
        tenantId: 'tenant_1',
        userId: 'user_1',
        eventKey: 'auth.password_reset.requested',
        subject: 'Reset your RE-OS password',
      }),
    );
    expect(queue.enqueue.mock.calls[0][2].body).toContain(
      'https://app.example.com/reset-password?token=',
    );
    expect(result.message).toBe(
      'If an account exists, password reset instructions have been sent.',
    );
  });

  it('does not queue email when no matching user exists', async () => {
    const { service, authRepository, queue } = buildService();
    authRepository.findUserByEmail.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'missing@example.com' });

    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: 'If an account exists, password reset instructions have been sent.',
    });
  });

  it('returns current profile details from the database', async () => {
    const { service, authRepository } = buildService();
    authRepository.findActiveUserById.mockResolvedValue({
      id: 'user_1',
      tenant_id: 'tenant_1',
      email: 'owner@example.com',
      first_name: 'Asha',
      last_name: 'Mehta',
      phone: '+919876543210',
    });

    const result = await service.me({
      userId: 'user_1',
      tenantId: 'tenant_1',
      roles: ['org_owner'],
      permissions: ['settings.read'],
    } as never);

    expect(result).toEqual({
      user_id: 'user_1',
      tenant_id: 'tenant_1',
      email: 'owner@example.com',
      first_name: 'Asha',
      last_name: 'Mehta',
      phone: '+919876543210',
      roles: ['org_owner'],
      permissions: ['settings.read'],
      feature_flags: {},
    });
  });

  it('updates profile fields and writes an audit event', async () => {
    const { service, authRepository, auditService } = buildService();
    authRepository.updateProfile.mockResolvedValue({
      id: 'user_1',
      tenant_id: 'tenant_1',
      email: 'owner@example.com',
      first_name: 'Asha',
      last_name: null,
      phone: '+919876543210',
    });

    const actor = {
      userId: 'user_1',
      tenantId: 'tenant_1',
      roles: ['org_owner'],
      permissions: ['settings.read'],
    } as never;
    const result = await service.updateProfile(
      actor,
      { first_name: ' Asha ', last_name: ' ', phone: '+919876543210' },
    );

    expect(authRepository.updateProfile).toHaveBeenCalledWith('user_1', {
      firstName: 'Asha',
      lastName: null,
      phone: '+919876543210',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.profile.updated',
        entityId: 'user_1',
      }),
    );
    expect(result.first_name).toBe('Asha');
    expect(result.last_name).toBeNull();
  });

  it('registers an agency transactionally and queues verification email', async () => {
    const { service, authRepository, auditService, queue } = buildService();
    authRepository.findOrganizationBySlug.mockResolvedValue(null);
    authRepository.findOrganizationByName.mockResolvedValue(null);
    authRepository.findAnyUserByEmail.mockResolvedValue(null);
    authRepository.findRoleByCode.mockResolvedValue({ id: 'role_owner' });
    authRepository.findActivePlanByCode.mockResolvedValue({ id: 'plan_starter' });
    authRepository.createRegisteredOrganization.mockResolvedValue({
      organization: {
        id: 'tenant_1',
        name: 'Acme Realty',
        slug: 'acme-realty',
        status: 'trial',
        tier: 'starter',
      },
      user: {
        id: 'user_1',
        email: 'owner@acme.in',
        first_name: 'Asha',
        last_name: 'Mehta',
        email_verified_at: null,
      },
      employee: { id: 'employee_1' },
      subscription: {
        id: 'sub_1',
        status: 'trial',
        billing_cycle: 'monthly',
        trial_ends_at: new Date('2026-06-26T00:00:00.000Z'),
        plan: { code: 'starter' },
      },
    });

    const result = await service.register({
      agency_name: 'Acme Realty',
      owner_name: 'Asha Mehta',
      email: 'OWNER@ACME.IN',
      password: 'ChangeMe123!',
      phone: '+919876543210',
    });

    expect(authRepository.createRegisteredOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyName: 'Acme Realty',
        slug: 'acme-realty',
        ownerEmail: 'owner@acme.in',
        ownerPhone: '+919876543210',
        ownerFirstName: 'Asha',
        ownerLastName: 'Mehta',
        ownerRoleId: 'role_owner',
        planId: 'plan_starter',
      }),
    );
    expect(queue.enqueue).toHaveBeenCalledWith(
      QUEUES.EMAIL,
      EMAIL_JOB,
      expect.objectContaining({
        tenantId: 'tenant_1',
        userId: 'user_1',
        eventKey: 'auth.email_verification.requested',
        subject: 'Verify your RE-OS email',
      }),
    );
    expect(queue.enqueue.mock.calls[0][2].body).toContain(
      'https://app.example.com/verify-email?token=',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_1',
        action: 'auth.register.completed',
      }),
    );
    expect(result.organization.slug).toBe('acme-realty');
    expect(result.verification_email_sent).toBe(true);
  });

  it('blocks login for registered users with pending email verification', async () => {
    const { service, authRepository, auditService } = buildService();
    authRepository.findOrganizationBySlug.mockResolvedValue({ id: 'tenant_1' });
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user_1',
      email: 'owner@acme.in',
      tenant_id: 'tenant_1',
      password_hash: 'hash',
      failed_login_count: 0,
      locked_until: null,
      email_verified_at: null,
    });
    authRepository.hasPendingEmailVerification.mockResolvedValue(true);
    jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true as never);

    await expect(
      service.login({
        email: 'owner@acme.in',
        password: 'ChangeMe123!',
        tenant_slug: 'acme-realty',
      }),
    ).rejects.toThrow('Email verification required before login');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_1',
        action: 'auth.login.email_unverified',
        entityId: 'user_1',
      }),
    );
  });

  it('verifies email with a one-time token', async () => {
    const { service, authRepository, auditService } = buildService();
    authRepository.consumeEmailVerificationToken.mockResolvedValue({
      user: {
        id: 'user_1',
        email: 'owner@acme.in',
        tenant_id: 'tenant_1',
        email_verified_at: new Date('2026-06-12T14:20:00.000Z'),
        tenant: {
          id: 'tenant_1',
          name: 'Acme Realty',
          slug: 'acme-realty',
        },
      },
    });

    const result = await service.verifyEmail({ token: 'verification-token-123456' });

    expect(authRepository.consumeEmailVerificationToken).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_1',
        action: 'auth.email.verified',
        entityId: 'user_1',
      }),
    );
    expect(result.organization?.slug).toBe('acme-realty');
    expect(result.message).toBe('Email verified. You can now sign in.');
  });

  it('rejects invalid or expired email verification tokens', async () => {
    const { service, authRepository } = buildService();
    authRepository.consumeEmailVerificationToken.mockResolvedValue(null);

    await expect(
      service.verifyEmail({ token: 'verification-token-123456' }),
    ).rejects.toThrow('Invalid or expired verification token');
  });

  it('rotates refresh tokens while preserving the token family', async () => {
    const { service, authRepository, auditService } = buildService();
    (service as unknown as { signAccessToken: jest.Mock }).signAccessToken = jest
      .fn()
      .mockResolvedValue('access-token');
    authRepository.findRefreshTokenByHash.mockResolvedValue({
      id: 'refresh_1',
      user_id: 'user_1',
      jti: 'jti_1',
      token_family_id: 'family_1',
      revoked_at: null,
      expires_at: new Date(Date.now() + 60_000),
    });
    authRepository.findUserById.mockResolvedValue({
      id: 'user_1',
      email: 'owner@acme.in',
      first_name: 'Asha',
      tenant_id: 'tenant_1',
    });
    authRepository.getRolesAndPermissions.mockResolvedValue({
      roles: ['org_owner'],
      permissions: ['billing.subscription.read'],
    });
    authRepository.revokeRefreshToken.mockResolvedValue({ count: 1 });
    authRepository.createRefreshToken.mockResolvedValue({});

    const result = await service.refresh(
      'refresh-token-123456',
      { userAgent: 'Jest', ipAddress: '127.0.0.1' },
    );

    expect(authRepository.revokeRefreshToken).toHaveBeenCalled();
    expect(authRepository.createRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        tokenFamilyId: 'family_1',
        userAgent: 'Jest',
        ipAddress: '127.0.0.1',
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.refresh.succeeded',
        entityId: 'refresh_1',
      }),
    );
    expect(result.access_token).toBe('access-token');
    expect(result.refresh_token).toEqual(expect.any(String));
  });

  it('detects reuse of a revoked refresh token and revokes the token family', async () => {
    const { service, authRepository, auditService } = buildService();
    authRepository.findRefreshTokenByHash.mockResolvedValue({
      id: 'refresh_1',
      user_id: 'user_1',
      jti: 'jti_1',
      token_family_id: 'family_1',
      revoked_at: new Date('2026-06-12T12:00:00.000Z'),
      expires_at: new Date(Date.now() + 60_000),
    });
    authRepository.findUserById.mockResolvedValue({
      id: 'user_1',
      email: 'owner@acme.in',
      tenant_id: 'tenant_1',
    });
    authRepository.revokeRefreshTokenFamily.mockResolvedValue({ count: 2 });

    await expect(
      service.refresh(
        'refresh-token-123456',
        { userAgent: 'Jest', ipAddress: '127.0.0.1' },
      ),
    ).rejects.toThrow('Invalid refresh token');

    expect(authRepository.revokeRefreshTokenFamily).toHaveBeenCalledWith(
      'user_1',
      'family_1',
      expect.any(Date),
    );
    expect(authRepository.revokeRefreshToken).not.toHaveBeenCalled();
    expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_1',
        action: 'auth.refresh.reuse_detected',
        entityId: 'refresh_1',
        afterState: {
          token_family_id: 'family_1',
          reused_jti: 'jti_1',
        },
      }),
    );
  });
});
