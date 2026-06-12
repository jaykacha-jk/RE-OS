import { clearSession, getSession, saveSession, type AuthSession } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

// ---------------------------------------------------------------------------
// Automatic access-token refresh
//
// Access tokens are short-lived (15 min). When a protected request returns 401
// we transparently exchange the stored refresh token for a fresh access token
// and replay the original request exactly once. A module-level single-flight
// promise guarantees that a burst of parallel 401s (e.g. a dashboard firing
// several requests at mount) triggers only ONE refresh round-trip. If the
// refresh itself fails we clear the session and bounce to /login — never retry
// again, so there is no possibility of an infinite 401 → refresh → 401 loop.
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const session = getSession();
  if (!session?.refresh_token) return null;

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!res.ok) return null;

    const body = (await res.json().catch(() => undefined)) as
      | { data?: AuthSession }
      | undefined;
    const data = body?.data;
    if (!data?.access_token || !data?.refresh_token || !data?.user) return null;

    // Persist the rotated refresh token + new access token and preserved claims.
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      user: data.user,
    });

    return data.access_token;
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

async function rawFetch(
  path: string,
  options: RequestInit & { token?: string },
): Promise<Response> {
  const { token, headers, ...rest } = options;
  return fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  // Transparent refresh + replay on expired access token.
  if (res.status === 401 && options.token && !_isRetry && !isAuthEndpoint(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, { ...options, token: newToken }, true);
    }
    // Refresh failed (expired/invalid/revoked refresh token) — log out cleanly.
    redirectToLogin();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw await parseError(res, body);
  }

  return body as ApiEnvelope<T>;
}

/**
 * Revoke the refresh token server-side, then clear the local session.
 * Best-effort: a network failure on revoke must never block the user from
 * logging out locally.
 */
export async function logout(): Promise<void> {
  const session = getSession();
  if (session?.refresh_token) {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
        keepalive: true,
      });
    } catch {
      /* ignore — clear local session regardless */
    }
  }
  clearSession();
}
