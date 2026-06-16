import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { importSPKI, jwtVerify } from 'jose';
import { getJwtPublicKeyPem } from '../../config/jwt-keys';
import type { AuthUser } from '../context/auth-user';
import type { TenantContext } from '../context/tenant-context';
import { readAccessToken } from '../utils/auth-cookies.util';

type JwtPayload = {
  sub: string;
  tid?: string | null;
  roles?: string[];
  permissions?: string[];
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const token = readAccessToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const publicKeyPem = getJwtPublicKeyPem();
    if (!publicKeyPem) {
      throw new UnauthorizedException('JWT_PUBLIC_KEY not configured');
    }

    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      const publicKey = await importSPKI(publicKeyPem, 'RS256');
      ({ payload } = await jwtVerify(token, publicKey, {
        algorithms: ['RS256'],
      }));
    } catch {
      // Malformed / expired / tampered token — never leak crypto errors as 500.
      throw new UnauthorizedException('Invalid or expired token');
    }

    const jwt = payload as unknown as JwtPayload;
    if (!jwt?.sub) throw new UnauthorizedException('Invalid JWT payload');

    const user: AuthUser = {
      userId: jwt.sub,
      tenantId: jwt.tid ?? null,
      roles: jwt.roles ?? [],
      permissions: jwt.permissions ?? [],
    };

    const tenant: TenantContext = {
      tenantId: user.tenantId ?? undefined,
    } as TenantContext;

    // Attach for downstream decorators/guards.
    req.user = user;
    req.tenant = user.tenantId ? tenant : undefined;

    return true;
  }
}

