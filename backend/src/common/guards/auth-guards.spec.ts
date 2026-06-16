import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';

import { REQUIRE_FEATURE_KEY } from '../constants/rbac.constants';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { TenantGuard } from './tenant.guard';
import { FeatureFlagGuard } from './feature-flag.guard';

jest.mock('jose', () => ({
  importSPKI: jest.fn().mockResolvedValue('public-key'),
  jwtVerify: jest.fn(),
}));

jest.mock('../../config/jwt-keys', () => ({
  getJwtPublicKeyPem: jest.fn(() => '-----BEGIN PUBLIC KEY-----\nmock\n-----END PUBLIC KEY-----'),
}));

function contextWithRequest(req: Record<string, unknown> = {}): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('fails closed when route permission metadata is missing', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce([]).mockReturnValueOnce(false),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(contextWithRequest({ user: { roles: [], permissions: [] } }))).toThrow(
      'Route missing permission configuration',
    );
  });

  it('allows auth-only routes without explicit permissions', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce([]).mockReturnValueOnce(true),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(contextWithRequest({ user: { roles: [], permissions: [] } }))).toBe(true);
  });

  it('allows super_admin and rejects missing permissions', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['billing.subscription.update']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(
      guard.canActivate(contextWithRequest({ user: { roles: ['super_admin'], permissions: [] } })),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextWithRequest({ user: { roles: ['org_admin'], permissions: ['billing.subscription.read'] } })),
    ).toThrow('Insufficient permissions');
  });
});

describe('TenantGuard', () => {
  it('requires tenant context and attaches req.tenant', () => {
    const guard = new TenantGuard();
    const req = { user: { tenantId: 'tenant_1' } };

    expect(guard.canActivate(contextWithRequest(req))).toBe(true);
    expect(req).toHaveProperty('tenant', { tenantId: 'tenant_1' });
    expect(() => guard.canActivate(contextWithRequest({ user: { tenantId: null } }))).toThrow(
      'Tenant context required',
    );
  });
});

describe('FeatureFlagGuard', () => {
  it('allows routes without feature metadata', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const features = { isEnabled: jest.fn() };
    const guard = new FeatureFlagGuard(reflector, features as never);

    await expect(guard.canActivate(contextWithRequest())).resolves.toBe(true);
    expect(features.isEnabled).not.toHaveBeenCalled();
  });

  it('requires tenant context for feature-gated routes', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue('ai') } as unknown as Reflector;
    const guard = new FeatureFlagGuard(reflector, { isEnabled: jest.fn() } as never);

    await expect(guard.canActivate(contextWithRequest({ user: { tenantId: null } }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('blocks disabled features', async () => {
    const reflector = {
      getAllAndOverride: jest.fn((key) => (key === REQUIRE_FEATURE_KEY ? 'ai' : undefined)),
    } as unknown as Reflector;
    const guard = new FeatureFlagGuard(reflector, { isEnabled: jest.fn().mockResolvedValue(false) } as never);

    await expect(guard.canActivate(contextWithRequest({ user: { tenantId: 'tenant_1' } }))).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('JwtAuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing access tokens', async () => {
    await expect(new JwtAuthGuard().canActivate(contextWithRequest({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches authenticated user and tenant from a valid RS256 token', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        sub: 'user_1',
        tid: 'tenant_1',
        roles: ['org_owner'],
        permissions: ['properties.read'],
      },
    });
    const req = { headers: { authorization: 'Bearer access-token' } };

    await expect(new JwtAuthGuard().canActivate(contextWithRequest(req))).resolves.toBe(true);
    expect(req).toHaveProperty('user', {
      userId: 'user_1',
      tenantId: 'tenant_1',
      roles: ['org_owner'],
      permissions: ['properties.read'],
    });
    expect(req).toHaveProperty('tenant', { tenantId: 'tenant_1' });
  });

  it('rejects invalid JWTs without leaking crypto errors', async () => {
    (jwtVerify as jest.Mock).mockRejectedValue(new Error('bad signature'));

    await expect(
      new JwtAuthGuard().canActivate(contextWithRequest({ headers: { authorization: 'Bearer bad' } })),
    ).rejects.toThrow('Invalid or expired token');
  });
});
