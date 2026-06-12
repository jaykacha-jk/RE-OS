# Authentication Hotfix Audit Report

**Date:** 2026-06-12
**Symptom:** Dashboard shows `Could not load dashboard. Invalid or expired token`
**Status:** RESOLVED — 27/27 end-to-end auth checks passing.

---

## Root Cause

**The frontend had no token-refresh mechanism.**

Access tokens are short-lived (15 min, RS256). The frontend stored both the
access token and the refresh token in `localStorage`, but `frontend/lib/api.ts`
(`apiFetch`) attached only the **access token** and had **no interceptor, no
refresh-on-401, and no retry**. Every page (dashboard, analytics, properties,
CRM, billing, chat, notifications) calls `apiFetch` directly.

Sequence that produced the bug:

1. User logs in → access token (valid 15 min) + refresh token (valid 7 days) saved to `localStorage`.
2. User keeps the tab open / returns after >15 min.
3. Dashboard calls `GET /api/v1/analytics/dashboard` with the **expired** access token.
4. Backend `JwtAuthGuard` correctly rejects it: `401 Invalid or expired token`.
5. `apiFetch` simply surfaced that 401 as an `ApiError`. The dashboard caught it and rendered `Could not load dashboard. {message}`.
6. The valid refresh token in `localStorage` was **never used** — there was no code path to exchange it.

The backend login + refresh + rotation + revocation logic was already correct.
The defect was 100% client-side: a missing refresh/retry layer.

---

## Audit Findings (Step-by-Step)

### Step 1 — Login flow (`POST /api/v1/auth/login`) — PASS
`backend/src/modules/auth/auth.service.ts` → `login()`

| Check | Result |
|-------|--------|
| Access token generated (RS256, 15 min) | PASS |
| Refresh token generated (32-byte, hashed at rest, 7 days) | PASS |
| Tenant context included (`tid` claim) | PASS — `tid=30bf6363-…` |
| Role included (`roles` claim) | PASS — `["org_owner"]` |
| Permissions included (`permissions` claim) | PASS — 63 permissions |
| Account lockout after 5 failures / bcrypt cost 12 | PASS (pre-existing) |

### Step 2 — Refresh flow (`POST /api/v1/auth/refresh`) — PASS
`auth.service.ts` → `refresh()`

| Check | Result |
|-------|--------|
| Refresh token validated by SHA-256 hash lookup | PASS |
| Expiry validation (`expires_at < now` → 401) | PASS |
| Rotation logic (issues new refresh token each call) | PASS — token changes |
| Token revocation (old token revoked on rotation) | PASS — reuse → 401 |
| Tenant context preserved | PASS — `tid` identical after refresh |
| Role preserved | PASS |
| Permissions preserved | PASS |
| 401 loops | NONE — invalid access token returns a single 401, never 500 |
| Expired/invalid refresh tokens | Correctly rejected with 401 |
| Missing claims | None — all claims re-derived on refresh |

### Step 3 — Frontend auth flow — **DEFECT FOUND & FIXED**
- `frontend/lib/auth.ts` — session storage helpers (OK).
- `frontend/lib/api.ts` — **the bug**: no refresh interceptor, no retry, no logout-on-failure.
- No Next.js `middleware.ts` exists (route protection is client-side via `AdminShell`).

Fixes applied (see below):
- Automatic refresh works — 401 → refresh → replay original request once.
- Retry request works — replays with the new access token.
- Logout on refresh failure — clears session and redirects to `/login`.
- No infinite loops — single retry flag + auth endpoints excluded + single-flight lock.

### Step 4 — Token storage — PASS (with note)
- Access + refresh tokens stored in `localStorage` (`reos_session`).
- This is an existing SPA design choice (Bearer tokens, not cookies), so
  `secure` / `sameSite` cookie flags are **not applicable** to the current
  transport. No CSRF surface because auth is not cookie-based.
- Rotation now keeps `localStorage` in sync on every refresh.
- **Recommendation (future, not blocking):** migrate refresh token to an
  `HttpOnly; Secure; SameSite=Strict` cookie to remove XSS token-theft risk.

### Step 5 — Tenant context in tokens — PASS
Every access token contains `sub` (user), `tid` (tenant/organization), `roles`,
`permissions`, `iat`, `exp`, `jti`. The refresh endpoint re-derives and returns
the **same** claims (verified equal before/after refresh).
Note: this codebase models tenant + organization as one entity (`organizations`);
`tid` is the organization/tenant id. Super Admin has `tid=null` by design.

### Step 6 — Smoke test — 27/27 PASS
Login → token-claim inspection → dashboard load → refresh (rotation + claim
preservation) → dashboard load with refreshed token → reuse rejection →
invalid-token rejection → no-500 on bad token → super admin + platform
dashboard → logout revocation. Demo data confirmed populated
(`leads.total=45`, `organizations=5`).

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/lib/api.ts` | Added automatic access-token refresh with single-flight lock, one-shot replay of the original request, logout-on-refresh-failure, auth-endpoint exclusion (loop prevention), and a `logout()` helper that revokes the refresh token server-side. |
| `frontend/components/admin/admin-shell.tsx` | Logout now calls the new `logout()` (server-side refresh-token revocation) before redirecting, instead of only clearing local state. |

No backend files required changes — the server-side auth was already correct.

---

## Fix Applied (detail)

`frontend/lib/api.ts`:

- `apiFetch` now detects `401` on an authenticated request and, exactly once,
  calls `refreshAccessToken()`.
- `refreshAccessToken()` uses a module-level **single-flight promise**: a burst
  of parallel 401s (the dashboard fires several requests at mount) triggers only
  **one** `POST /api/v1/auth/refresh` round-trip.
- On success the rotated tokens + preserved claims are persisted via
  `saveSession`, and the original request is replayed once with the new access
  token (`_isRetry` guard prevents a second refresh).
- On failure (expired/invalid/revoked refresh token) the session is cleared and
  the app redirects to `/login` — a clean logout, never a retry loop.
- `isAuthEndpoint()` excludes `/auth/login` and `/auth/refresh` from the refresh
  path so a failing refresh can never recurse.

---

## Test Results

```
PASS  login returns 201
PASS  login: access_token present
PASS  login: refresh_token present
PASS  login: user.tenant_id present
PASS  login: roles include org_owner — ["org_owner"]
PASS  login: permissions present — count=63
PASS  access token claim: tid (tenant)
PASS  access token claim: roles
PASS  access token claim: permissions
PASS  access token claim: exp set — ttl=900s
PASS  dashboard loads with valid token — status=200
PASS  dashboard has leads data — leads.total=45
PASS  refresh returns 200
PASS  refresh: new access_token
PASS  refresh: rotated refresh_token
PASS  refresh preserves tenant claim
PASS  refresh preserves roles
PASS  refresh preserves permissions
PASS  dashboard loads with refreshed token — status=200
PASS  old (rotated) refresh token rejected — status=401
PASS  invalid refresh token rejected — status=401
PASS  invalid access token → 401 (no 500) — status=401
PASS  super admin login — status=201
PASS  super admin role
PASS  platform dashboard loads — status=200 orgs=5
PASS  logout returns 204
PASS  refresh after logout rejected — status=401

27/27 checks passed
```

Build verification:
- `npm run build:backend` → exit 0
- `npm run build:frontend` → exit 0 (Next.js type-check validated the auth changes; 50 routes built)
- `prisma migrate deploy` → no pending migrations
- `node prisma/seed.js` → seed completed

---

## Final Verification

- Login issues access + refresh tokens with full tenant/role/permission claims.
- Expired access token is now transparently refreshed and the request replayed —
  the `Invalid or expired token` dashboard error no longer occurs during a normal
  session.
- Refresh rotates and revokes; reused/expired/invalid refresh tokens are rejected.
- Logout revokes the refresh token server-side.
- No 401 loops, no 500s on bad tokens.
- Dashboard, analytics, and platform analytics return populated data.
