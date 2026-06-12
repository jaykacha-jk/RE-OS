# RE-OS Platform Stabilization Report

**Sprint:** Release-candidate hardening (Phases 1–6) before Phase 7 (Billing)
**Date:** 2026-06-10
**Scope:** Stability, bug fixing, tenant isolation, RBAC, analytics, observability, UX. **No new features.**

---

## 1. Executive summary

Three reported production failures were root-caused and fixed, plus two latent defects discovered during the audit. All fixes are verified with passing unit tests (118/118), clean backend + frontend builds, and live API probes (see `API_HEALTH_REPORT.md`).

**Production readiness: 8 / 10** — core Phases 1–6 are functionally stable and correctly isolated per tenant. There is **no hard launch blocker**: the queue layer falls back to an in-memory async driver when Redis is unconfigured, so background jobs run in single-instance dev. For durable/multi-instance production queues, provision Redis ≥ 5.0.0 (the previously-seen error only occurred because an old Redis 3.0.504 was explicitly configured).

---

## 2. Root causes found

### CR-1 — Database migration drift (CRITICAL)
Three migrations were never applied to the running database:
- `20260609130000_add_crm_inquiry_domain`
- `20260609140000_add_notifications_domain`
- `20260609150000_add_chat_domain`

**Impact:** Any query touching inquiries / notifications / chat tables threw a Prisma "table does not exist" error → **`GET /api/v1/platform/analytics/dashboard` 500** (it aggregates inquiry counts platform-wide), and every CRM/Notifications/Chat endpoint would have 500'd in a fresh environment.

### CR-2 — Stale role permissions (CRITICAL)
The database was seeded before `analytics.read`, `platform.analytics.read`, and chat permissions were added to `seed.js`. Existing roles never received the new grants.

**Impact:** `org_owner` got **403 on `/api/v1/analytics/dashboard` and `/api/v1/analytics/employees`** (presented to the user as "Tenant context required" once they were rerouted). Super admin lacked `platform.analytics.read`.

### CR-3 — JWT guard leaked crypto errors as 500 (HIGH)
`JwtAuthGuard` called `jwtVerify` without a try/catch. A malformed, expired, or tampered token threw a raw `jose` error that escaped to the global filter as **500** instead of **401**.

### CR-4 — `TIER_TO_PLAN` mis-map: `pro → 'pro'` (HIGH)
`pro` tier was mapped to plan code `'pro'`, which does not exist in `subscription_plans` (`starter` / `growth` / `enterprise`).

**Impact:**
- `AnalyticsService.getPlatformDashboard` — `pro`-tier orgs contributed **₹0** to MRR/ARR (silent revenue under-count).
- `EmployeesRepository.findPlanMaxEmployees` — `pro`-tier orgs fell back to the `starter` employee quota, wrongly throttling employee creation.

### CR-5 — 5xx errors silently swallowed (MED, observability)
`HttpExceptionFilter` returned a JSON error envelope but never logged 5xx faults or their stack traces, making the analytics 500 above effectively undiagnosable from logs.

---

## 3. Fixes applied

| ID | Fix | File(s) |
|----|-----|---------|
| CR-1 | Ran `prisma migrate deploy` to apply the 3 pending migrations | DB state (`backend/prisma/migrations/*`) |
| CR-2 | Re-ran `prisma/seed.js` (idempotent `upsert` of `role_permissions`); added `analytics.read` to org roles and `platform.analytics.read` to super admin | `backend/prisma/seed.js` (verified additive) |
| CR-3 | Wrapped `jwtVerify` in try/catch → throw `UnauthorizedException('Invalid or expired token')`; added explicit header + public-key guards | `backend/src/common/guards/jwt-auth.guard.ts` |
| CR-4 | Corrected map `pro → 'growth'` in both call sites | `backend/src/modules/analytics/analytics.service.ts`, `backend/src/modules/employees/employees.repository.ts` |
| CR-5 | Log 5xx with `method url -> status [requestId]` + stack at `error` level; 4xx at `debug` | `backend/src/common/filters/http-exception.filter.ts` |

---

## 4. Tenant context audit (TASK 2)

**Finding: there is no tenant-derivation bug.** The flow is correct end-to-end:

- **Login** accepts an optional `tenantSlug`; org users resolve their `tenant_id` from the slug and it is embedded as the `tid` claim in the RS256 JWT.
- **`JwtAuthGuard`** reads `tid` → sets `req.user.tenantId` and `req.tenant`.
- **`TenantGuard`** throws `Tenant context required` **only when `tenantId` is absent** — which is the case exclusively for **super admin** (platform-scoped, no tenant). This is by design.
- The frontend routes super admin to the **platform** dashboard (`PlatformDashboard`) and org users to the tenant dashboard, so super admin never hits the tenant-scoped analytics endpoints in normal use.

**Verified per role:** Owner / Admin / Manager / Sales / Telecaller all receive a valid `tid` and pass `TenantGuard`. Scope narrowing (owner/admin = org-wide, sales/telecaller = assigned) is enforced in the service layer and confirmed live (sales sees only assigned records).

The original "Tenant context required" symptom was a **consequence of CR-2** (org owner 403'd on analytics), not a tenant-resolution failure.

---

## 5. Analytics audit (TASK 3)

- All endpoints (`dashboard`, `leads`, `properties`, `employees`, `funnel`, `sources`, `conversions`, `revenue`) return **200** for org owner and sales.
- Empty-DB handling, null guards, and division-by-zero guards verified (conversion rates default to 0 when denominators are 0).
- MRR/ARR now compute correctly after CR-4 (demo org: MRR ₹6,999 / ARR ₹83,988).
- In-memory TTL cache verified non-blocking.

---

## 6. RBAC audit (TASK 5)

| Boundary | Result |
|----------|--------|
| Sales → `/platform/analytics/dashboard` | 403 ✅ |
| Super admin → tenant analytics | 403 (by design) ✅ |
| Org owner → analytics suite | 200 (after CR-2) ✅ |
| Invalid/expired token → any protected route | 401 (after CR-3) ✅ |
| Sales scope | assigned-only, enforced server-side ✅ |

Frontend nav links are permission-guarded via the session permission set; super-admin vs org rendering is driven by `isSuperAdmin(session)`. No unauthorized client route exposes data without a corresponding API-side guard.

---

## 7. Seed data audit (TASK 7)

Seed (`backend/prisma/seed.js`) creates: subscription plans, permissions, roles + `role_permissions` (idempotent upsert), super admin, demo organization (`demo`), demo users (owner + sales), properties, lead sources, and supporting CRM rows. Re-running is safe. **Operational note:** a fresh checkout must run `prisma migrate deploy` **before** `seed.js`, otherwise CR-1 recurs.

---

## 8. Observability (TASK 9)

- Global exception filter now logs all 5xx with request id + stack (CR-5).
- Each error response carries a `request_id` for correlation.
- Audit log endpoint verified (`GET /api/v1/audit-logs` → 200).
- Socket gateway and BullMQ wiring present; queue processing blocked by Redis version (see risks).

---

## 9. Final verification (TASK 10)

| Check | Result |
|-------|--------|
| Backend build (`npm run build`) | ✅ clean |
| Frontend build (`next build`) | ✅ clean |
| Unit tests | ✅ 118 / 118 passing (11 suites) |
| API health sweep | ✅ see `API_HEALTH_REPORT.md` |
| Tenant isolation | ✅ verified |
| Analytics / Notifications / Chat / CRM / Property endpoints | ✅ 200 |

---

## 10. Remaining risks & launch blockers

| Severity | Item | Detail / Action |
|----------|------|-----------------|
| MED | Redis `3.0.504` < `5.0.0` (when configured) | The queue layer auto-falls-back to an **in-memory async driver** when `REDIS_URL`/`REDIS_HOST` are unset, so background jobs run in single-instance dev. The earlier "Redis version" failure only happened because an old Redis was explicitly configured. **Action for production durability / multi-instance:** provision Redis ≥ 5 (e.g. Docker `redis:7`) and set `REDIS_URL`; otherwise leave it unset to use the in-memory driver. |
| HIGH (ops) | Migration drift | Fresh/existing environments must run `prisma migrate deploy` on deploy. **Action:** add to the deploy runbook / CI step. |
| MED | Billing endpoints present but ungated | Phase 7 billing controllers exist; `org_owner` lacks `billing.*` perms → 403. Expected; resolve in Billing phase. |
| LOW | Frontend empty/error/loading states | All 24 dashboard pages carry loading/empty/error handling patterns and prerender cleanly (no SSR crashes in `next build`). Remaining work is cosmetic polish (skeleton consistency, friendlier copy), not stability. |

---

## 11. Production readiness score

**8 / 10**

- Phases 1–6 APIs: stable, tenant-isolated, RBAC-correct, builds clean, 118/118 tests green.
- Deduct for: pending fresh-env migration runbook, recommended Redis ≥ 5 for durable production queues, and in-flight frontend UX-state polish.
- **No hard launch blocker.** Add `prisma migrate deploy` to the deploy runbook and (for multi-instance production) provision Redis ≥ 5.0.0; the platform is then fit for controlled onboarding.
