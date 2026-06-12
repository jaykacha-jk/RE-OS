export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    roles: string[];
    tenant_id: string | null;
    permissions: string[];
  };
};

const SESSION_KEY = 'reos_session';

export function saveSession(session: AuthSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

export function isSuperAdmin(session: AuthSession | null) {
  return session?.user.roles.includes('super_admin') ?? false;
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
