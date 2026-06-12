# RE-OS — Project Audit Report

**Audit date:** 2026-06-11
**Auditor role:** External CTO / due-diligence (CEO, CTO, Principal Architect, Staff BE/FE, QA Lead, SaaS PM hats)
**Method:** Code-verified. Documentation claims were **not** trusted; every status was checked against actual source, schema, migrations, and a live test run.
**Verdict in one line:** Architecturally strong, feature-broad MVP with real backend depth — **but not production-ready**. Launch is blocked primarily by DevOps (no CI/CD, no app containers, no monitoring/backups), billing webhook security, transactional email, and the complete absence of integration/E2E and cross-tenant isolation tests.

---

## 0. What was actually verified

| Evidence | Result |
|----------|--------|
| Backend test run (`npm --workspace backend run test -- --runInBand`) | **179 tests / 23 suites passing** (all unit, mocked repos) |
| Prisma schema | 1,559 lines, ~55 models, 8 migrations applied |
| Backend controllers | 25 controllers across 16 modules |
| Frontend routes | 56 `page.tsx` files (App Router) |
| Spec files | 23 `*.spec.ts` — **0** `*.e2e-spec.ts`, **0** integration tests, **0** frontend tests |
| CI/CD (`.github/workflows`) | **None** (only `node_modules` artifacts) |
| App Dockerfiles | **None** (only `docker-compose.yml` for Postgres + Redis infra) |
| Scheduler / cron module | **None** (`@nestjs/schedule` not used) |

> **Documentation accuracy note:** `docs/IMPLEMENTATION_STATUS.md` is largely accurate on *what code exists*, but **overstates production readiness**. It self-reports phases at 88–95% while marking integration tests, production email, custom-domain DNS/SSL, live Razorpay, and deployment as deferred. Per the audit rules (API without tests = PARTIAL; code without UI = PARTIAL), several "✅ ~95%" phases are downgraded below.

---

## STEP 2 — Phase-by-Phase Audit

> Phase names follow the audit request. Note: the code's internal roadmap numbering is **inconsistent** — there is both a "Phase 8 = Public Website & SEO" and a roadmap row "Phase 8 = AI calling agent", and AI actually shipped as "Phase 10". This naming drift should be reconciled.

| Phase | Status | Completion | Prod-Ready | Top remaining work |
|-------|--------|-----------:|:----------:|--------------------|
| **1 — Foundation** (Auth, RBAC, Org, Employees, Audit) | PARTIAL | **80%** | **N** | Forgot-password email dispatch; cross-tenant isolation tests; refresh-rotation E2E; global guard strategy |
| **2 — Property Management** | COMPLETE | **90%** | **Y\*** | Drag-reorder UI, image upload widget, area/facet SEO; subdomain routing |
| **3 — CRM / Inquiry Pipeline** | COMPLETE | **90%** | **Y\*** | Integration tests; reassign-on-employee-delete (BR-E02) |
| **4 — Analytics & Dashboards** | COMPLETE | **88%** | **Y\*** | Redis cache backend; CSV/PDF export; integration tests |
| **5 — Notifications & Automation** | PARTIAL | **80%** | **N** | Production ESP (email throws); durable scheduler (delayed jobs are fragile); WhatsApp |
| **6 — Live Chat** | PARTIAL | **78%** | **N** | Public website chat widget embed; @mentions; integration tests |
| **7 — Billing (Razorpay)** | PARTIAL | **68%** | **N** | Raw-body HMAC webhook; live subscription creation; invoice PDF; lifecycle cron (trial→expire, past_due→suspend); timing-safe compare |
| **8 — Public Website + SEO** | PARTIAL | **65%** | **N** | Buyer accounts/profile, saved properties, public chat widget; `/listings` metadata; area pages; render tenant branding |
| **9 — Enterprise + White Label** | PARTIAL | **80%** | **N** | Real DNS/SSL provisioning + host→tenant routing middleware; Redis cache; asset upload; public site consumes settings |
| **10 — AI Agent Platform** (bonus, built) | PARTIAL | **70%** | **N** | Real telephony (Twilio/Exotel are mock); live LLM cost controls; TRAI/consent compliance; load testing |

`Y\*` = production-ready **as a feature module in isolation**, but gated by the platform-wide blockers (DevOps, billing, email, tests) in Steps 7–11.

---

## STEP 3 — Module Audit

| Module | Status | Compl. | API | FE | Tests | Prod-Ready | Known issues |
|--------|--------|------:|----:|---:|------:|-----------:|--------------|
| **Authentication** | PARTIAL | 85% | 95% | 90% | 0%† | 60% | RS256/bcrypt/lockout/refresh good; **forgot-password never sends email** (`auth.service.ts` ~L341-371); no auth integration tests |
| **Organizations (Platform)** | COMPLETE | 90% | 95% | 70% | 60% | 75% | No dedicated create-org page (inline only); owner invite email = dev-log stub |
| **Employees** | COMPLETE | 88% | 95% | 80% | 50% | 80% | BR-E02 reassign-on-delete deferred; `users`/`employees` tables lack `created_by`/`updated_by` |
| **RBAC** | COMPLETE | 85% | 90% | 70% | 60% | 75% | Guards applied **per-controller, not global**; routes without `@RequirePermissions` are authz-open by design |
| **Properties** | COMPLETE | 92% | 95% | 90% | **High** | 85% | Mutations update by id after scoped read (not `updateMany` tenant-scoped); reorder UI missing |
| **CRM** | COMPLETE | 92% | 95% | 90% | **High** | 85% | Suspended-org check present here; subordinate lookup not tenant-scoped |
| **Analytics** | COMPLETE | 88% | 90% | 90% | **High** | 82% | In-memory cache only; raw SQL is parameterized (OK) |
| **Notifications** | PARTIAL | 82% | 90% | 90% | **High** | 65% | Prod email provider **throws**; delayed reminders rely on non-durable queue |
| **Chat** | PARTIAL | 80% | 90% | 85% | Med | 65% | No public widget; socket auth via localStorage token |
| **Billing** | PARTIAL | 68% | 85% | 85% | Med | 45% | **Webhook signs `JSON.stringify(dto)` not raw body**; no timing-safe compare; secret optional outside prod; no lifecycle cron; no PDF |
| **Public Website** | PARTIAL | 65% | 80% | 70% | 0% | 55% | No buyer accounts/saved; `/listings` lacks route metadata |
| **SEO** | PARTIAL | 72% | n/a | 75% | 0% | 70% | JSON-LD + sitemap + ISR good; area/facet pages deferred |
| **Settings** | COMPLETE | 85% | 90% | 90% | High | 75% | Public site doesn't yet render tenant branding end-to-end |
| **White Label** | PARTIAL | 78% | 85% | 85% | Med | 60% | DNS/SSL simulated; no host→tenant routing middleware |
| **Audit Logs** | COMPLETE | 88% | 95% | 85% | High | 80% | CSV export RFC-4180 escaped; only one index `(tenant_id, created_at)` — actor/action filters unindexed |
| **Public Analytics** | COMPLETE | 82% | 90% | 80% | High | 75% | IP-hashing for privacy; in-memory cache |

† No dedicated `auth.service.spec.ts` / guard unit tests were found; auth logic is exercised only indirectly. Cross-tenant isolation tests are **explicitly absent** (confirmed in code + docs).

---

## STEP 4 — Database Audit

**Overall: strong design, scalable shape, one structural risk (isolation model).**

What's good:
- **Relationships:** Comprehensive FKs; cascade deletes on child media/messages/transcripts; AI module intentionally uses *plain columns* for cross-aggregate refs (clean module decoupling, FKs in migration).
- **Indexes:** Excellent. Composite tenant-scoped indexes everywhere (`@@index([tenant_id, status])`, `(tenant_id, city)`, `(tenant_id, created_at)`, etc.) plus `@@index([deleted_at])` on soft-deleted tables.
- **Constraints:** Composite uniques `(tenant_id, slug)`, `(tenant_id, property_code)`, `(tenant_id, inquiry_code)`, `(tenant_id, invoice_number)`; webhook `provider_event_id` unique for idempotency.
- **Soft deletes:** `deleted_at` consistent on business tables; queries filter `deleted_at: null`.
- **Audit fields:** `created_by`/`updated_by` present on properties, inquiries, billing, settings, etc.

Findings / risks:
| Severity | Finding |
|----------|---------|
| **High** | **Tenant isolation is application-layer only.** No Postgres Row-Level Security. A single missed `where: { tenant_id }` leaks cross-tenant data; there are **no tests** guarding this. |
| Medium | `users` and `employees` tables **lack `created_by`/`updated_by`** audit columns (inconsistent with the rest of the schema). |
| Medium | `audit_logs` has only `@@index([tenant_id, created_at])`. The Phase-9 advanced filters (action, entity, actor email) and CSV export will table-scan at volume. |
| Medium | AI embeddings stored as JSON float arrays (pgvector "seam" only). Real semantic search at scale needs `pgvector` + ANN index; current cosine-in-JS will not scale. |
| Low | No table partitioning / archival strategy for high-churn tables (`messages`, `inquiry_activities`, `public_analytics_events`, `ai_usage_events`) — fine for MVP, a 1000-tenant risk. |
| Low | `BigInt` storage counters and `Decimal(14,2)` money are correct; no money-as-float bugs found. |

Missing tables vs roadmap: none critical. Pipeline stages are a String union by design (documented). No `pipeline_stages` table is acceptable for the fixed MVP pipeline.

---

## STEP 5 — API Audit

**API Health Score: 7.5 / 10**

| Dimension | Verdict | Evidence |
|-----------|---------|----------|
| REST consistency | OK | `/api/v1/*` nouns, 201/204 used, `{data, meta}` envelope on most endpoints |
| Validation | **OK (strong)** | Global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` (`main.ts` L33-39); class-validator DTOs throughout |
| Error handling | OK | Global `HttpExceptionFilter` → `{ error: { code, message, request_id } }`; crypto errors never leak as 500 |
| Pagination/Filter/Sort | OK | `page`/`per_page`/`total`/`total_pages` consistent in services |
| RBAC | **PARTIAL** | Per-controller guards (not global). `PermissionsGuard` returns `true` when no `@RequirePermissions` — so any new endpoint without the decorator is silently authz-open |
| Tenant isolation | **PARTIAL** | Reads scoped via JWT `@TenantId()` (never from body — good). But several **mutations update/delete by `id`** after a scoped pre-check rather than a tenant-scoped `updateMany`; subordinate-employee lookups not tenant-scoped |
| Webhook | **GAP** | Razorpay webhook receives parsed `@Body()` and HMACs `JSON.stringify(dto)` — **not the raw payload bytes** → real signatures will fail / verification is unsound; plain equality compare (not timing-safe); secret optional outside prod |
| Envelope uniformity | Minor | Health + CSV export intentionally bypass the envelope (acceptable) |

---

## STEP 6 — Frontend Audit

**Scores:** UX **7/10** · Design **7/10** · Mobile **6/10** · Accessibility **5/10**

- **Stack:** Next 15 (App Router), React 19, Tailwind 3.4, `socket.io-client`. **No** TanStack Query, **no** shadcn/ui (the `components/ui` dir is effectively empty), **no** react-hook-form/zod, **no** chart library (charts are hand-rolled CSS/SVG), **no** toast system.
- **Real, API-backed pages:** dashboard, properties (list/new/[id]/edit), inquiries, pipeline (Kanban drag/drop), analytics, performance, billing (5 pages), chat, settings (10+ pages), AI (7 pages), audit logs, employees, lead sources, platform orgs, public site (`/`, `/listings`, `/[intent]/[city]`, detail). **No "coming soon" stubs found** — pages are genuinely implemented.
- **Gaps (downgrade to PARTIAL):**
  - **No refresh-token flow** despite storing `refresh_token` in `localStorage` → sessions hard-fail on access-token expiry.
  - Session in `localStorage` (XSS-exposed) rather than httpOnly cookies.
  - Manual `required`/`minLength` validation only; no schema validation, no field-level error mapping, **no toast notifications**.
  - Accessibility: inconsistent `htmlFor` label association, limited ARIA, drag/drop pipeline has **no keyboard alternative**.
  - Two competing Tailwind configs (`tailwind.config.js` vs `.ts`) — ambiguous source of truth.
  - No OpenAPI→TS generated client (the backend exposes `/api/v1/openapi.json` but it's unused).
  - Missing buyer features: registration/profile, saved properties, public chat widget.
  - INR formatting exists; phone formatting (+91) mostly raw.

---

## STEP 7 — Testing Audit

**Testing Score: 4 / 10**

| Layer | State |
|-------|-------|
| Backend unit | **Strong** — 179 tests, 23 suites, business logic + RBAC scope well covered (properties, CRM, analytics, notifications, billing, settings, AI engines) |
| Backend integration (live Postgres) | **MISSING** — 0 files; explicitly deferred "to CI" that doesn't exist |
| Cross-tenant isolation tests | **MISSING** — the single most important multi-tenant safety test does not exist (BR / SECURITY both require it) |
| E2E (API or browser) | **MISSING** — 0 files |
| Frontend tests | **MISSING** — `frontend` test script is `echo "tests to be added"` |
| Coverage gates | **None** — no coverage threshold, no CI enforcement |
| Webhook raw-body verification test | **MISSING** |

**Critical gaps:** (1) tenant isolation, (2) auth/guard tests, (3) billing webhook idempotency + signature against real payloads, (4) any frontend test, (5) any test touching a real database.

---

## STEP 8 — Security Audit

**Security Score: 5.5 / 10**

| Control | Status | Notes |
|---------|--------|-------|
| JWT RS256 | ✅ Good | `jose`, verify-only public key in guard, RS256 enforced, no error leakage |
| Password hashing | ✅ Good | bcrypt; lockout after 5 failed attempts (BR-A03) |
| Refresh tokens | ✅ Good | Hashed + stored; rotation/reuse path exists (untested E2E) |
| RBAC | 🟡 Partial | Works, but **guards are per-controller**; missing-decorator = open; no global `APP_GUARD` for auth/perms |
| Tenant isolation | 🟡 Partial | App-layer only, no RLS, **no isolation tests**; mutation scoping weaker than ideal |
| Rate limiting | ✅ Good | `@nestjs/throttler` global 120/min + auth 10/min; per-route auth throttles |
| Security headers | ✅ Good | HSTS/X-Frame-Options/etc. middleware on `*` |
| Password reset | ❌ Gap | Token created but **email never sent** → reset flow non-functional in production |
| Billing webhook | ❌ Gap | HMAC over parsed DTO not raw body; non-timing-safe compare; secret optional |
| Suspended-org read-only (BR-T02) | 🟡 Partial | Enforced only in **3 read paths** (crm, settings, public-analytics) — **not global**; suspended tenants can still mutate properties/inquiries via write endpoints |
| Secrets management | 🟡 Partial | `.env` only; SECURITY.md mandates AWS Secrets Manager — not wired |
| Audit logging | ✅ Good | Auth, CRUD, settings, billing mutations logged with before/after, IP, UA |
| CORS | ✅ Good | Origin from env, not `*` |

---

## STEP 9 — DevOps Audit

**DevOps Score: 3 / 10 — the single biggest launch blocker.**

| Item | Status |
|------|--------|
| Docker (infra) | 🟡 `docker-compose.yml` provides Postgres 16 + Redis 7 with healthchecks |
| Docker (apps) | ❌ **No Dockerfile** for backend or frontend — apps are not containerized/deployable |
| Environment config | 🟡 `.env.example` present; secrets only via env files; no secrets manager |
| Redis | 🟡 Available in compose, but app defaults to **in-memory queue + in-memory caches** when Redis URL absent → jobs/caches lost on restart |
| Postgres | ✅ Migrations applied (8); seed present |
| CI/CD | ❌ **None** — no pipeline for lint/test/build/deploy |
| Secrets management | ❌ Env files only |
| Monitoring / APM | ❌ None (no Sentry/Datadog/OTel) |
| Logging | 🟡 Nest logger to stdout; no structured aggregation/shipping |
| Backups | ❌ None defined |
| Staging | ❌ Not deployed (per docs) |
| Scheduler | ❌ No cron/`@nestjs/schedule`; lifecycle relies on fragile delayed queue jobs |

---

## STEP 10 — Launch Readiness

| Scale | Verdict | Rationale |
|-------|---------|-----------|
| **1 agency (pilot)** | 🟡 **Yes, with manual ops** | Core CRM/property/chat flows work. Must hand-hold billing (manual), work around no reset-password email, and accept no monitoring. Pilot/design-partner only. |
| **10 agencies** | 🟠 **Risky** | Needs transactional email, durable Redis queues, basic monitoring, and a deploy pipeline. Billing automation gaps become real revenue/leakage risk. |
| **100 agencies** | 🔴 **No** | No CI/CD, no containers, no scheduler, in-memory queues, no monitoring/backups, no tenant-isolation tests. Operationally unsustainable. |
| **1000 agencies** | 🔴 **No** | Requires RLS or proven isolation, Redis-backed everything, observability, backups/DR, partitioning/archival, pgvector for AI, horizontal scaling + load tests. None present. |

**Top launch risks:** (1) cross-tenant data leak (untested isolation), (2) billing webhook unsound → payment/activation failures, (3) no transactional email (reset/invite broken), (4) no deploy/monitoring/backups, (5) no integration/E2E safety net.

---

## STEP 11 — Final Project Scorecard

| Dimension | Score (/10) |
|-----------|:-----------:|
| Architecture | **8.5** |
| Backend | **8.0** |
| Frontend | **7.0** |
| UI / UX | **6.5** |
| Security | **5.5** |
| Testing | **4.0** |
| SEO | **7.0** |
| Scalability | **6.5** |
| DevOps | **3.0** |
| Launch Readiness | **4.0** |
| **Overall Product** | **6.0** |

> Full breakdown and weighting in `docs/PROJECT_SCORECARD.md`.

---

## STEP 14 — Roadmap (summary; full backlog in `docs/PROJECT_BACKLOG.md`)

**30 days — "Make it safe to charge one agency":**
1. CI/CD pipeline (lint + test + build) + backend & frontend Dockerfiles.
2. Fix Razorpay webhook: raw-body HMAC, `timingSafeEqual`, mandatory secret, idempotency-on-success-only.
3. Wire a transactional email provider (SES/SendGrid) → reset password, invites, billing emails.
4. Cross-tenant isolation integration test suite against live Postgres.
5. Default to Redis-backed queue + cache in all non-test environments.

**60 days — "Make it sustainable for 10–50 agencies":**
6. Durable scheduler (`@nestjs/schedule`) for trial→expire, past_due→suspend (BR-T02), missed-followup.
7. Global suspended-org read-only guard; global auth/permissions guard strategy.
8. Monitoring (Sentry/OTel) + structured logging + automated DB backups.
9. Frontend: token refresh, toast system, react-hook-form/zod, OpenAPI-generated client.
10. Billing: live Razorpay subscriptions + invoice PDF worker.

**90 days — "Scale & polish":**
11. Public buyer accounts, saved properties, first-party chat widget embed.
12. Real custom-domain DNS/SSL + host→tenant routing middleware.
13. pgvector for AI knowledge; real telephony (Twilio/Exotel) behind the existing abstraction.
14. Area/facet programmatic SEO; render tenant branding on public site.
15. Load testing + audit_logs/messages indexing & partitioning.

**Recommended next phase:** **Phase 11 — "Production Hardening"** (DevOps + billing + email + isolation tests). Do **not** build new product surface until the platform can be safely deployed, monitored, billed, and isolation-tested.
