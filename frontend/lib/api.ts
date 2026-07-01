import {
  browserApiBase,
  clearSession,
  getSession,
  hasActiveSession,
  saveSession,
  sessionFromMe,
  usesCookieAuth,
  effectiveTenantId,
  type AuthSession,
  type MeResponse,
} from './auth';

const API_BASE =
  typeof window !== 'undefined'
    ? browserApiBase()
    : (process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4545');

export type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const session = getSession();
  const cookieMode = usesCookieAuth();
  if (!cookieMode && !session?.refresh_token) return null;

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: session?.refresh_token
        ? JSON.stringify({ refresh_token: session.refresh_token })
        : '{}',
    });

    if (!res.ok) return null;

    const body = (await res.json().catch(() => undefined)) as
      | { data?: AuthSession }
      | undefined;
    const data = body?.data;
    if (!data?.user) return null;

    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      user: data.user,
      impersonation: getSession()?.impersonation,
    });

    return data.access_token ?? (cookieMode ? 'cookie' : null);
  } catch {
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function redirectToLogin() {
  clearSession();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

function isAuthEndpoint(path: string): boolean {
  return path.includes('/api/v1/auth/login') || path.includes('/api/v1/auth/refresh');
}

function resolveToken(explicit?: string): string | undefined {
  if (usesCookieAuth()) return undefined;
  if (explicit) return explicit;
  return getSession()?.access_token;
}

async function rawFetch(
  path: string,
  options: RequestInit & { token?: string },
): Promise<Response> {
  const { token, headers, ...rest } = options;
  const resolved = resolveToken(token);
  const impersonationTenantId = effectiveTenantId(getSession());
  return fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(resolved ? { Authorization: `Bearer ${resolved}` } : {}),
      ...(impersonationTenantId ? { 'X-Tenant-Id': impersonationTenantId } : {}),
      ...headers,
    },
  });
}

async function parseError(res: Response, body: unknown): Promise<ApiError> {
  const errObj =
    typeof body === 'object' && body && 'error' in body
      ? (body as { error: { message?: string } }).error
      : null;
  const message =
    errObj?.message ??
    (typeof body === 'object' && body && 'message' in body
      ? String((body as { message: string }).message)
      : `Request failed (${res.status})`);
  return new ApiError(message, res.status, body);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
  _isRetry = false,
): Promise<ApiEnvelope<T>> {
  const res = await rawFetch(path, options);

  const shouldRefresh =
    res.status === 401 &&
    !_isRetry &&
    !isAuthEndpoint(path) &&
    (options.token || getSession()?.access_token || usesCookieAuth());

  if (shouldRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const nextOptions =
        newToken === 'cookie'
          ? { ...options, token: undefined }
          : { ...options, token: newToken };
      return apiFetch<T>(path, nextOptions, true);
    }
    redirectToLogin();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw await parseError(res, body);
  }

  return body as ApiEnvelope<T>;
}

export async function logout(): Promise<void> {
  const session = getSession();
  if (session?.impersonation?.tenant_id) {
    try {
      await rawFetch('/api/v1/platform/impersonation/end', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: session.impersonation.tenant_id }),
      });
    } catch {
      /* proceed with logout */
    }
  }
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: session?.refresh_token
        ? JSON.stringify({ refresh_token: session.refresh_token })
        : '{}',
      keepalive: true,
    });
  } catch {
    /* ignore — clear local session regardless */
  }
  clearSession();
}

/** Restore session from httpOnly cookies when sessionStorage is empty or stale. */
export async function hydrateSession(): Promise<AuthSession | null> {
  const existing = getSession();
  const shouldTryMe =
    usesCookieAuth() || (existing?.user?.id && !existing.access_token);
  if (!shouldTryMe) return existing;

  try {
    const { data } = await apiFetch<MeResponse>('/api/v1/auth/me');
    const session = sessionFromMe(data, existing);
    saveSession(session);
    return session;
  } catch {
    return usesCookieAuth() ? null : existing;
  }
}

export { hasActiveSession };
