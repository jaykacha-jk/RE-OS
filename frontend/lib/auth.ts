export type FeatureFlags = Record<string, boolean>;

export type ImpersonationState = {
  tenant_id: string;
  org_name: string;
  org_slug: string;
};

export type AuthSession = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    roles: string[];
    tenant_id: string | null;
    permissions: string[];
    feature_flags?: FeatureFlags;
  };
  /** Super Admin support login into a tenant workspace. */
  impersonation?: ImpersonationState | null;
};

const SESSION_KEY = 'reos_session';
const COOKIE_SESSION_TOKEN = '__reos_cookie_session__';

/**
 * In local dev, prefer the Next.js `/api` rewrite when the UI and API run on
 * different localhost ports (e.g. :3000 → :4545). Same-origin requests avoid
 * CORS issues and keep httpOnly auth cookies on the UI origin.
 */
export function browserApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured || typeof window === 'undefined') return configured ?? '';
  if (process.env.NODE_ENV === 'production') return configured;
  try {
    const target = new URL(configured);
    const here = new URL(window.location.href);
    const localHost =
      (target.hostname === 'localhost' || target.hostname === '127.0.0.1') &&
      (here.hostname === 'localhost' || here.hostname === '127.0.0.1');
    if (localHost && target.origin !== here.origin) return '';
  } catch {
    /* ignore invalid URL */
  }
  return configured;
}

/** Same-origin API (Next rewrite) — tokens live in httpOnly cookies only. */
export function usesCookieAuth(): boolean {
  if (typeof window === 'undefined') return false;
  if (!process.env.NEXT_PUBLIC_API_URL) return true;
  return browserApiBase() === '';
}

export function saveSession(session: AuthSession) {
  if (typeof window === 'undefined') return;
  const persisted: AuthSession = usesCookieAuth()
    ? {
        user: session.user,
        access_token: session.access_token,
        expires_in: session.expires_in,
      }
    : session;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(persisted));
}

export function hasActiveSession(session: AuthSession | null | undefined): boolean {
  if (!session?.user?.id) return false;
  if (usesCookieAuth()) return true;
  return !!session.access_token;
}

export function getBearerToken(session: AuthSession | null | undefined): string | undefined {
  if (!session) return undefined;
  if (usesCookieAuth()) return undefined;
  return session.access_token;
}

export type MeResponse = {
  user_id: string;
  tenant_id: string | null;
  email: string;
  first_name: string | null;
  last_name?: string | null;
  phone?: string | null;
  roles: string[];
  permissions: string[];
  feature_flags?: FeatureFlags;
};

export function sessionFromMe(data: MeResponse, existing?: AuthSession | null): AuthSession {
  return {
    access_token: existing?.access_token ?? (usesCookieAuth() ? COOKIE_SESSION_TOKEN : undefined),
    expires_in: existing?.expires_in,
    user: {
      id: data.user_id,
      email: data.email,
      first_name: data.first_name,
      roles: data.roles,
      tenant_id: data.tenant_id,
      permissions: data.permissions,
      feature_flags: data.feature_flags,
    },
    impersonation: existing?.impersonation,
  };
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (localStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, raw);
      localStorage.removeItem(SESSION_KEY);
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function isSuperAdmin(session: AuthSession | null) {
  return session?.user.roles.includes('super_admin') ?? false;
}

export function isImpersonating(session: AuthSession | null): boolean {
  return !!session?.impersonation?.tenant_id;
}

export function effectiveTenantId(session: AuthSession | null): string | null {
  if (!session) return null;
  return session.impersonation?.tenant_id ?? session.user.tenant_id;
}

export function sessionWithEffectiveTenant(session: AuthSession): AuthSession {
  const tenantId = effectiveTenantId(session);
  if (!tenantId || tenantId === session.user.tenant_id) return session;
  return {
    ...session,
    user: { ...session.user, tenant_id: tenantId },
  };
}

export function hasPermission(session: AuthSession | null, permission: string) {
  if (!session) return false;
  if (session.user.roles.includes('super_admin')) return true;
  return session.user.permissions.includes(permission);
}

export function hasAnyRole(session: AuthSession | null, roles: string[]) {
  if (!session) return false;
  return session.user.roles.some((r) => roles.includes(r));
}

export function isFeatureEnabled(session: AuthSession | null, feature?: string): boolean {
  if (!feature || !session) return true;
  if (isSuperAdmin(session)) return true;
  const flags = session.user.feature_flags;
  if (!flags) return true;
  return flags[feature] !== false;
}
