# API Health Report — RE-OS Stabilization Sprint

**Generated:** 2026-06-10
**Backend:** `http://localhost:4545` (`node dist/main.js`, production build)
**Method:** Live HTTP probes with seeded accounts (super admin, demo org owner, demo sales executive) after applying migration + seed + code fixes documented in `STABILIZATION_REPORT.md`.

## Seeded test accounts

| Role | Email | Password | Tenant slug |
|------|-------|----------|-------------|
| Super Admin | `super@reos.dev` | `ChangeMe123!` | _(none — platform scope)_ |
| Org Owner | `owner@demo.realty` | `ChangeMe123!` | `demo` |
| Sales Executive | `sales@demo.realty` | `ChangeMe123!` | `demo` |

## Auth & status-code matrix (verified)

| Scenario | Endpoint | Expected | Actual |
|----------|----------|----------|--------|
| Valid login (super) | `POST /api/v1/auth/login` | 200 | ✅ 200 |
| Valid login (owner + slug) | `POST /api/v1/auth/login` | 200 | ✅ 200 |
| Missing `Authorization` header | `GET /api/v1/analytics/dashboard` | 401 | ✅ 401 |
| Malformed bearer token | `GET /api/v1/analytics/dashboard` | 401 | ✅ 401 *(was 500 — fixed)* |
| Tampered signature | `GET /api/v1/analytics/dashboard` | 401 | ✅ 401 *(was 500 — fixed)* |
| Insufficient permission (sales → platform) | `GET /api/v1/platform/analytics/dashboard` | 403 | ✅ 403 |
| Tenant endpoint as super admin | `GET /api/v1/analytics/dashboard` | 403 `Tenant context required` | ✅ 403 *(by design — FE routes super admin to platform dashboard)* |
| Not found | `GET /api/v1/inquiries/{random-uuid}` | 404 | ✅ 404 |
| Public listing, missing required `tenant` | `GET /api/v1/public/properties` | 400 | ✅ 400 |
| Public listing, unknown tenant | `GET /api/v1/public/properties?tenant=bogus` | 404 | ✅ 404 |
| Health probe | `GET /health` | 200 | ✅ 200 |

## Endpoint sweep by role

### Super Admin
| Endpoint | Result |
|----------|--------|
| `GET /api/v1/platform/analytics/dashboard` | ✅ 200 — MRR ₹6,999 / ARR ₹83,988 / orgs 1 / users 3 *(was 500 — fixed)* |
| `GET /api/v1/platform/organizations` | ✅ 200 |

### Org Owner (org-wide scope)
| Endpoint | Result |
|----------|--------|
| `GET /api/v1/analytics/dashboard` | ✅ 200 *(was 403 — fixed)* |
| `GET /api/v1/analytics/leads` | ✅ 200 |
| `GET /api/v1/analytics/properties` | ✅ 200 |
| `GET /api/v1/analytics/employees` | ✅ 200 *(was 403 — fixed)* |
| `GET /api/v1/analytics/funnel` | ✅ 200 |
| `GET /api/v1/analytics/sources` | ✅ 200 |
| `GET /api/v1/analytics/conversions` | ✅ 200 |
| `GET /api/v1/analytics/revenue` | ✅ 200 |
| `GET /api/v1/employees` | ✅ 200 |
| `GET /api/v1/properties` | ✅ 200 |
| `GET /api/v1/lead-sources` | ✅ 200 |
| `GET /api/v1/inquiries` | ✅ 200 *(table was missing — fixed)* |
| `GET /api/v1/inquiries/metrics` | ✅ 200 |
| `GET /api/v1/conversations` | ✅ 200 *(table was missing — fixed)* |
| `GET /api/v1/conversations/unread-count` | ✅ 200 |
| `GET /api/v1/notifications` | ✅ 200 *(table was missing — fixed)* |
| `GET /api/v1/notifications/unread-count` | ✅ 200 |
| `GET /api/v1/notification-preferences` | ✅ 200 |
| `GET /api/v1/notification-templates` | ✅ 200 |
| `GET /api/v1/audit-logs` | ✅ 200 |
| `GET /api/v1/auth/me` | ✅ 200 |

### Sales Executive (assigned scope)
| Endpoint | Result |
|----------|--------|
| `GET /api/v1/analytics/dashboard` | ✅ 200 (scope = assigned) |
| `GET /api/v1/analytics/employees` | ✅ 200 (empty — assigned scope) |
| `GET /api/v1/inquiries` | ✅ 200 |
| `GET /api/v1/platform/analytics/dashboard` | ✅ 403 (correctly denied) |

## Known non-blocking results

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /api/v1/billing/*` (as owner) | 403 | **Phase 7 (Billing)** controllers are already present in the codebase but `billing.*` permissions are not granted to `org_owner` in the seed. Out of scope for this Phases 1–6 hardening sprint; flagged for the Billing phase. |
| BullMQ async jobs | falls back to in-memory driver | When `REDIS_URL`/`REDIS_HOST` are unset, the queue uses an in-memory async driver (jobs still run, single-instance). BullMQ requires Redis `>= 5.0.0` only when explicitly configured. REST/auth/realtime unaffected. See `STABILIZATION_REPORT.md` → Remaining Risks. |

## Summary

- **All Phase 1–6 endpoints probed return correct status codes.**
- The three originally-reported failures (platform 500, tenant `analytics/dashboard` + `analytics/employees`) are **resolved and verified**.
- Auth boundary is correct across 401 / 403 / 404 / 400 / 200.
- Remaining items are environmental (Redis) or out-of-scope (Billing perms).
