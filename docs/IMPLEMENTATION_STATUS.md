# RE-OS Implementation Status

**Last updated:** 2026-06-10 (Phase 10 — AI Agent Platform)  
**Current phase:** Phase 10 — AI Agent Platform (voice, chat, qualification, matching, follow-ups, intelligence, RAG)  
**Legend:** ✅ Done · 🟡 Partial / scaffold only · ❌ Not started

> **Phase 10 (AI Agent Platform) — ✅ implemented & validated.** Provider-abstracted
> (Mock + OpenAI, future-ready for Claude/Gemini/DeepSeek). New `modules/ai` with
> lead qualification, property matching, AI chat (RAG + handoff), AI voice agent
> (call → transcript → summary → qualification → CRM), follow-up automation,
> conversation intelligence, vector knowledge base, usage/cost analytics, RBAC,
> and 7 admin UI pages. Migration `20260610170000_add_ai_agent_platform` applied;
> seed adds AI permissions, plan AI minutes, prompt templates, and demo knowledge.
> 31 AI unit tests pass; all AI endpoints smoke-tested green. See `AI_ARCHITECTURE.md`.

---

## Summary

| Area | Done | Partial | Not started | Completion |
|------|------|---------|-------------|------------|
| **Documentation & rules** | 45 | 0 | 0 | **100%** |
| **Backend (Admin API)** | 37 | 5 | 1 | **~88%** |
| **Admin UI (tenant + platform)** | 14 | 1 | 7 | **~64%** |
| **Public Web (client-facing)** | 10 | 3 | 2 | **~67%** |
| **DevOps / local setup** | 6 | 1 | 1 | **~75%** |
| **Overall product (Phases 1–9)** | — | — | — | **~22%** |

> **Overall product %** = weighted across all 9 roadmap phases (docs complete; code mostly Phase 1 shell).

---

## 1. Documentation & Architecture — 100% ✅

| # | Item | Status |
|---|------|--------|
| 1 | `docs/PLAN.md` — master plan | ✅ |
| 2 | `docs/PRD.md` — product requirements | ✅ |
| 3 | `docs/SYSTEM_DESIGN.md` — architecture | ✅ |
| 4 | `docs/DB_SCHEMA.md` — database design | ✅ |
| 5 | `docs/API_SPEC.md` — REST API spec | ✅ |
| 6 | `docs/RBAC.md` — roles & permissions | ✅ |
| 7 | `docs/BUSINESS_RULES.md` — domain rules | ✅ |
| 8 | `docs/SECURITY.md` | ✅ |
| 9 | `docs/DEPLOYMENT.md` | ✅ |
| 10 | `docs/MVP_ROADMAP.md` — 9 phases | ✅ |
| 11 | `docs/BILLING_SPEC.md` | ✅ |
| 12 | `docs/AI_AGENT_SPEC.md` | ✅ |
| 13 | `docs/SEO_STRATEGY.md` | ✅ |
| 14 | `docs/GROWTH_STRATEGY.md` | ✅ |
| 15 | `docs/REVENUE_MODEL.md` | ✅ |
| 16 | `docs/KPI_FRAMEWORK.md` | ✅ |
| 17 | `docs/COMPETITOR_ANALYSIS.md` | ✅ |
| 18 | `docs/UI_UX_GUIDELINES.md` | ✅ |
| 19 | `docs/CODING_STANDARDS.md` | ✅ |
| 20 | `.cursor/rules/` — 16 rule files | ✅ |
| 21 | `.cursor/skills/` — 10 domain skills | ✅ |
| 22 | Root + backend + frontend README | ✅ |
| 23 | Folder structure (`backend/`, `frontend/`) | ✅ |

---

## 2. Backend — Admin API — ~88%

### 2.1 Platform & tooling

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | npm workspaces monorepo | ✅ | `package.json` root |
| 2 | NestJS app boots | ✅ | `backend/src/main.ts` |
| 3 | TypeScript strict build | ✅ | `npm run build:backend` |
| 4 | Global `ValidationPipe` | ✅ | whitelist + transform |
| 5 | **Swagger UI** | ✅ | `http://localhost:3001/api/v1/docs` |
| 6 | **OpenAPI JSON** (for web + future app) | ✅ | `http://localhost:3001/api/v1/openapi.json` |
| 7 | Bearer auth in Swagger | ✅ | `@ApiBearerAuth()` on `/auth/me` |
| 8 | Prisma schema (Phase 1 tables) | ✅ | `backend/prisma/schema.prisma` |
| 9 | Prisma client generated | ✅ | `@prisma/client` |
| 10 | Prisma `prisma.config.ts` (Prisma 7) | ✅ | datasource in config file |
| 11 | `docker-compose.yml` (Postgres + Redis) | ✅ | Added at repo root |
| 12 | DB migrations applied | ✅ | Applied to local Postgres (`postgres` DB) |
| 13 | Seed (roles, permissions, plans) | ✅ | `backend/prisma/seed.js` + super admin user |
| 14 | `.env.example` | ✅ | Root `.env.example` with DB/JWT/Redis |

### 2.2 Health

| # | Endpoint | Status |
|---|----------|--------|
| 1 | `GET /health` | ✅ |
| 2 | Swagger tag + docs for health | ✅ |

### 2.3 Auth (Phase 1)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | `POST /api/v1/auth/login` | ✅ | RS256 + bcrypt; super admin + tenant |
| 2 | `POST /api/v1/auth/refresh` | ✅ | Token rotation + revoke on reuse path |
| 3 | `POST /api/v1/auth/logout` | ✅ | Revokes refresh token |
| 4 | `GET /api/v1/auth/me` | ✅ | JWT guard wired |
| 5 | Login / refresh / logout DTOs | ✅ | class-validator |
| 6 | bcrypt password verify | ✅ | BR-A02 ready |
| 7 | JWT RS256 sign (access token) | ✅ | `.keys/` or env PEM |
| 8 | JWT RS256 verify (guard) | ✅ | `.keys/` or env PEM |
| 9 | Refresh token storage (hashed) | ✅ | Prisma model + repo |
| 10 | `POST /auth/forgot-password` | 🟡 | Creates reset token; email dispatch deferred |
| 11 | `POST /auth/reset-password` | ✅ | Consumes token + resets password |
| 12 | Failed login lockout (BR-A03) | ✅ | Locks after 5 failed attempts |
| 13 | User invitations flow | ✅ | `accept-invitation` + dev token in create responses |
| 14 | `POST /auth/accept-invitation` | ✅ | Sets password + issues tokens |

### 2.4 RBAC & security foundation

| # | Item | Status |
|---|------|--------|
| 1 | `JwtAuthGuard` | ✅ |
| 2 | `PermissionsGuard` | ✅ |
| 3 | `@RequirePermissions()` decorator | ✅ |
| 4 | `@CurrentUser()` / `@TenantId()` decorators | ✅ |
| 5 | `TenantGuard` (middleware) | ✅ |
| 6 | RBAC seed in database | ✅ | Platform + employee permissions; super_admin mapped |
| 7 | Role/permission load on login | ✅ | Platform super_admin permissions loaded from DB |
| 8 | Tenant isolation integration tests | ❌ |
| 9 | Rate limiting | ✅ | Global + stricter auth throttles |
| 10 | Security headers middleware | ✅ | HSTS, X-Frame-Options, etc. |
| 11 | Global HTTP exception filter | ✅ | `{ error: { code, message } }` envelope |

### 2.5 Organization (Super Admin)

| # | Item | Status |
|---|------|--------|
| 1 | `PlatformModule` (controller/service/repo) | ✅ | Full Phase 1 platform module |
| 2 | `GET /platform/organizations` | ✅ | Pagination + status/tier filters |
| 3 | `POST /platform/organizations` | ✅ | Creates org + owner invitation record |
| 4 | `PATCH /platform/organizations/:id` | ✅ | status, tier, billing_email, name |
| 5 | Org provisioning (slug, tier, trial) | ✅ | status=`trial`, usage row created |
| 6 | Owner invitation email | 🟡 | `USER_INVITED` event + email queue (dev provider logs); production ESP TBD |

### 2.6 Employees (Org Admin)

| # | Item | Status |
|---|------|--------|
| 1 | `EmployeesModule` (controller/service/repo) | ✅ | Full CRUD |
| 2 | `GET /employees` | ✅ | Filters + pagination |
| 3 | `POST /employees` | ✅ | Quota check BR-T04 |
| 4 | `GET /employees/:id` | ✅ |
| 5 | `PATCH /employees/:id` | ✅ |
| 6 | `DELETE /employees/:id` | ✅ | Soft delete |
| 7 | Manager hierarchy validation | ✅ | Invalid manager blocked |
| 8 | Reassign on delete (BR-E02) | 🟡 | Deferred until inquiries (Phase 3) |

### 2.7 Audit

| # | Item | Status |
|---|------|--------|
| 1 | `audit_logs` table in Prisma | ✅ |
| 2 | Audit write on auth / CRUD | ✅ | Auth, org create/update, employee create/update/delete |
| 3 | `GET /audit-logs` | ✅ | Tenant-scoped; Super Admin can filter tenant |

### 2.8 Phase 1 acceptance criteria (from roadmap)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Super Admin creates org; owner logs in | 🟡 | Use `/accept-invitation` or seeded owner |
| 2 | Org Admin adds 5 employees with roles | 🟡 | Create UI on `/employees` |
| 3 | Sales Executive blocked from employee API | ✅ | Smoke tested: `sales@demo.realty` gets 403 |
| 4 | Cross-tenant API test passes | ❌ |
| 5 | Refresh token rotation works E2E | 🟡 |
| 6 | 80%+ test coverage on auth + guards | ❌ |
| 7 | Deployed to staging | ❌ |

**Phase 1 backend score: 37 ✅ · 5 🟡 · 1 ❌ → ~88%**

---

## 3. Admin UI (Tenant + Super Admin) — ~64%

Target users: Organization Owner, Org Admin, Sales Manager, Super Admin.

| # | Screen / feature | Route (planned) | Status |
|---|------------------|-----------------|--------|
| 1 | App shell + layout | `app/layout.tsx` | ✅ |
| 2 | Login page (real form + API) | `/login` | ✅ | Live — tested against running API |
| 3 | Forgot password page | `/forgot-password` | ✅ | Calls `POST /auth/forgot-password` |
| 3b | Accept invitation page | `/accept-invitation` | ✅ | Token from query + password form |
| 3c | Reset password page | `/reset-password` | ✅ | Calls `POST /auth/reset-password` |
| 4 | shadcn/ui components | `components/ui/` | ❌ | Folder exists; no components |
| 5 | TanStack Query + API client | `lib/api.ts` | 🟡 | Fetch wrapper; no TanStack Query yet |
| 6 | Auth context / session | `lib/auth.ts` | ✅ | localStorage session |
| 7 | Protected route middleware | `AdminShell` | ✅ | Client redirect if no session |
| 8 | Role-based sidebar nav | `AdminShell` | ✅ | Super Admin vs tenant nav |
| 9 | **Dashboard** (empty state / KPIs) | `/dashboard` | ✅ | Activation checklist empty state |
| 10 | **Super Admin: Org list** | `/platform/organizations` | ✅ | List + create form |
| 11 | **Super Admin: Create org** | `/platform/organizations/new` | ❌ |
| 12 | **Super Admin: Edit org** | inline on list | ✅ | Status/tier/name PATCH |
| 13 | **Employee list** | `/employees` | ✅ | List + create form |
| 14 | **Employee create / delete** | `/employees` | ✅ | Create form + Remove action |
| 14b | **Audit logs** | `/audit-logs` | ✅ | Permission-gated list + filters |
| 15 | **Profile settings** | `/settings/profile` | ✅ | Account, roles, permissions |
| 16 | Permission-gated buttons (RBAC UI) | — | 🟡 | Sidebar + audit nav gated; button-level polish later |
| 17 | Toast / error handling | — | ❌ |
| 18 | INR / +91 phone formatting | — | ❌ |
| 19 | OpenAPI client codegen from spec | — | ❌ | Can use `/api/v1/openapi.json` |
| 20 | Responsive admin layout | — | ❌ |

**Admin UI score: 14 ✅ · 1 🟡 · 7 ❌ → ~64%**

---

## 4. Public Web (Client-facing) — ~67%

Target users: Property buyers/renters (Client role), SEO visitors.

| # | Screen / feature | Route (planned) | Status |
|---|------------------|-----------------|--------|
| 1 | Marketing / home landing | `/` | ✅ | Tenant-aware public landing with hero search + featured listings |
| 2 | **Public property listing** | `/listings?tenant={slug}` | ✅ | SSR/ISR, search/city filter, SEO route links |
| 3 | **Property detail (SSR + SEO)** | `/listings/{slug}?tenant={slug}` | ✅ | Compatibility route canonicalizes to SEO detail |
| 4 | Rent listings | `/rent/{city}/{slug}` | ✅ | Canonical detail route family |
| 5 | City / area hub pages (programmatic SEO) | `/buy/{city}` | 🟡 | City hubs for buy/rent/commercial; area/facet pages deferred |
| 6 | Submit inquiry form | On property page | ✅ | Public form creates CRM inquiry |
| 7 | Client registration / profile | `/profile` | ❌ |
| 8 | Saved properties | `/saved` | ❌ |
| 9 | **Live chat widget** | embed | 🟡 | WhatsApp CTA present; first-party chat widget embed deferred |
| 10 | `generateMetadata` + JSON-LD | `/listings/{slug}`, `/{intent}/{city}/{slug}` | ✅ | Metadata, canonical, Open Graph, Twitter cards, RealEstateListing JSON-LD |
| 11 | Sitemap + robots.txt | `/sitemap.xml`, `/robots.txt` | ✅ | Tenant-aware sitemap capped to public listings |
| 12 | Tenant subdomain routing (`{slug}.reos.app`) | — | 🟡 | Host-derived fallback in sitemap; full custom-domain routing deferred |
| 13 | Mobile-responsive property cards | — | ✅ | Responsive grids/cards on home, listings, city hubs |
| 14 | EMI calculator on detail page | — | ❌ | Optional |

**Public web score: 1 ✅ · 1 🟡 · 12 ❌ → ~7%**

---

## 5. Cross-cutting (Web + Admin + API)

| # | Item | Status | Used by |
|---|------|--------|---------|
| 1 | Swagger for API discovery | ✅ | Admin devs, future mobile app |
| 2 | OpenAPI JSON export | ✅ | Client SDK generation |
| 3 | Shared API envelope `{ data, meta }` | 🟡 | Auth controller only |
| 4 | Standard error envelope | ✅ | `HttpExceptionFilter` |
| 5 | CORS for frontend origin | ✅ | `CORS_ORIGIN` / localhost:3000 |
| 6 | Shared TypeScript types (OpenAPI → types) | ❌ | `frontend/types/` empty |

---

## 6. Roadmap phases — high level

| Phase | Name | Backend | Admin UI | Public Web |
|-------|------|---------|----------|------------|
| **1** | Foundation (Auth, RBAC, Org, Employee) | 🟡 ~88% | 🟡 ~64% | 🟡 ~7% |
| **2** | Property management | ✅ ~95% | ✅ ~90% | 🟡 ~40% |
| **3** | CRM / Inquiry pipeline | ✅ ~95% | ✅ ~90% | ❌ 0% |
| **4** | Dashboard & reports | ✅ ~95% | ✅ ~90% | — |
| **5** | Notifications & Automation | ✅ ~95% | ✅ ~90% | — |
| **6** | Live chat | ✅ ~90% | ✅ ~85% | 🟡 ~10% (widget foundation) |
| **7** | Billing (Razorpay) | ✅ ~90% | ✅ ~85% | — |
| **8** | AI calling agent | ❌ 0% | ❌ 0% | — |
| **9** | Enterprise (settings, domains, white-label, public analytics) | ✅ ~92% | ✅ ~90% | 🟡 ~40% (public ingest + settings API) |

---

## 7. What works right now (smoke test)

Start backend (port **3001**):

```bash
npm run build:backend
npm run dev:backend
```

| URL | What you get |
|-----|----------------|
| http://localhost:3001/health | `{ "status": "ok" }` |
| http://localhost:3001/api/v1/docs | **Swagger UI** (Auth + Health) |
| http://localhost:3001/api/v1/openapi.json | **OpenAPI 3** JSON for codegen |

Start frontend (port **3000**):

```bash
npm run dev:frontend
```

| URL | What you get |
|-----|----------------|
| http://localhost:3000 | Home shell |
| http://localhost:3000/login | Sign in (super / tenant slug) |
| http://localhost:3000/forgot-password | Forgot password form |
| http://localhost:3000/reset-password | Reset password form |
| http://localhost:3000/accept-invitation | Accept invite + set password |
| http://localhost:3000/dashboard | Admin dashboard |
| http://localhost:3000/employees | Employee list (tenant) |
| http://localhost:3000/audit-logs | Audit trail (permission-gated) |
| http://localhost:3000/settings/profile | Profile / permissions |
| http://localhost:3000/platform/organizations | Org list (super admin) |

> Auth API calls need `DATABASE_URL`, `JWT_PRIVATE_KEY`, and `JWT_PUBLIC_KEY` plus migrated/seeded DB.

---

## 8. Recommended next steps (in order)

1. 🟡 `docker-compose.yml` + `.env.example` + seed done; run `prisma migrate deploy` when Postgres is up  
2. ✅ Login UI wired to `POST /api/v1/auth/login`  
3. ✅ `GET/POST/PATCH /platform/organizations` implemented  
4. ✅ `GET/POST/PATCH/DELETE /employees` implemented  
5. ✅ Admin dashboard shell + sidebar (role-aware)  
6. ✅ Audit logging + `GET /audit-logs` implemented  
7. ✅ Reset password, lockout, and rate limiting implemented  
8. ❌ → ✅ OpenAPI → TypeScript client for frontend (`openapi-typescript`)

---

## 9. Quick reference — tick counts

| Category | ✅ | 🟡 | ❌ | Total items |
|----------|----|----|-----|-------------|
| Documentation & rules | 23 | 0 | 0 | 23 |
| Backend (Admin API) | 37 | 5 | 1 | 43 |
| Admin UI | 14 | 1 | 7 | 22 |
| Public Web | 10 | 3 | 2 | 15 |
| DevOps / setup | 6 | 1 | 1 | 8 |

*Update this file when a feature ships; keep in sync with `docs/MVP_ROADMAP.md` acceptance criteria.*

---

## 10. Phase 2 — Property Management Domain

**Status:** Core revenue engine. Backend + Admin UI production-grade; public web is a foundation.

### ✅ Completed

**Backend — `backend/src/modules/properties/`**

| Item | Notes |
|------|-------|
| Prisma models: `properties`, `property_images`, `property_videos`, `property_documents`, `property_amenities`, `property_tags`, `property_assignments`, `property_history` | Migration `add_property_domain` applied |
| Indexes on `tenant_id`, `status`, `city`, `category`, `type`, `price`, `requirement_type`, `is_public` | + composite uniques `(tenant_id, slug)`, `(tenant_id, property_code)` |
| Soft delete (`deleted_at`) on properties | All queries filter `deleted_at: null` |
| Property CRUD: `POST/GET/GET:id/PATCH/DELETE /api/v1/properties` | Controller → Service → Repository, tenant-scoped |
| Slug + `property_code` auto-generation with uniqueness retry | `3bhk-flat-in-sg-highway` style |
| Status workflow with transition guard | draft→pending_review→published→reserved→sold→archived |
| Property history (price/status/assignment/property_updated) | Written transactionally on update/assign |
| Assignment (`POST /api/v1/properties/:id/assign`) | Multi-agent + single primary (BR-P06), validates tenant membership |
| Media: images (add/delete/reorder/set-cover), videos, documents | S3 abstraction + local-disk fallback (`StorageService`) |
| Search + filters + pagination + sorting | title/code/city search; type/category/status/requirement/city/assigned_user/min-max price |
| Quota enforcement on create (BR-T04) | `QUOTA_EXCEEDED` 422 |
| Public endpoints: `GET /api/v1/public/properties`, `GET /api/v1/public/properties/:slug` | Tenant resolved via `?tenant=` slug; public-safe DTO only |
| RBAC enforced at API (guards/permissions) **and** service (scope resolution) | full-access / team / assigned-only |
| Static file serving for local uploads (`/static/...`) | `main.ts` |
| Permission seeds + role mappings | `properties.{create,read,update,delete,assign}` |

**Admin UI — `frontend/app/(dashboard)/properties/`**

| Item | Route |
|------|-------|
| Properties listing (search, filters, sortable columns, pagination) | `/properties` |
| Create page | `/properties/new` |
| Edit page | `/properties/[id]/edit` |
| Detail page (image mgmt, assigned agents, history timeline) | `/properties/[id]` |
| Assignment modal | inline on detail |
| Permission-gated nav + action buttons | `properties.read/create/update/delete/assign` |

**Public Web — `frontend/app/listings/`**

| Item | Route |
|------|-------|
| Public listing (SSR, search + city filter) | `/listings?tenant={slug}` |
| Public detail (SSR + `generateMetadata` + JSON-LD) | `/listings/[slug]?tenant={slug}` |
| Canonical city hubs | `/buy/[city]`, `/rent/[city]`, `/commercial/[city]` |
| Canonical property details | `/buy/[city]/[slug]`, `/rent/[city]/[slug]`, `/commercial/[city]/[slug]` |
| Sitemap and robots | `/sitemap.xml`, `/robots.txt` |

**Tests — `backend/src/modules/properties/properties.service.spec.ts`**

| Suite | Coverage |
|-------|----------|
| RBAC scope | full-access / manager-team / executive-assigned / no-employee |
| Access enforcement | out-of-scope 404, allowed access, missing 404 |
| Create + quota + slug | BR-T04 quota, slug gen, slug collision suffix |
| Status workflow + history | invalid transition, price+status history, archive→is_public=false |
| Assignment logic | invalid ids, bad primary, default primary, dedupe |
| List/search | scope + filters passed to repo, meta shape |
| Soft delete | audit record + repo call |
| **Result** | **19 tests passing** (`npm test`) |

### 🟡 In progress / partial

| Item | Notes |
|------|-------|
| Tenant/domain routing | Query-param tenant fallback works; production subdomain/custom-domain routing still needs middleware/domain mapping |
| Integration tests against live Postgres | Service-level unit tests cover the business logic; DB-backed e2e deferred to CI setup |
| Image upload UI | Add-by-URL + cover/delete in UI; drag-reorder available via API, not yet wired in UI |
| Area/facet programmatic pages | City hubs shipped; area and BHK/facet pages deferred until content quality gates are backed by data |

### ❌ Blocked / out of scope (by instruction)

CRM / Inquiry, Chat, Billing, AI Agent — intentionally not started in Phase 2.

---

## 11. Phase 3 — CRM / Inquiry Pipeline

**Status:** Primary revenue engine. Backend + Admin UI production-grade. Public inquiry submission and the analytics dashboard are deferred to later phases (metrics service methods are ready).

### ✅ Completed

**Backend — `backend/src/modules/crm/`**

| Item | Notes |
|------|-------|
| Prisma models: `lead_sources`, `inquiries`, `inquiry_notes`, `inquiry_activities`, `inquiry_followups`, `inquiry_assignments`, `inquiry_history`, `site_visits` | Migration `add_crm_inquiry_domain` |
| Indexes on `tenant_id`, `stage`, `assigned_employee_id`, `source_id`, `created_at`, `phone`, `email` | + composite unique `(tenant_id, inquiry_code)` |
| Soft delete (`deleted_at`) on inquiries | All active queries filter `deleted_at: null` |
| Inquiry CRUD: `POST/GET/GET:id/PATCH/DELETE /api/v1/inquiries` | Controller → Service → Repository, tenant-scoped |
| Auto `inquiry_code` generation (`INQ-XXXXXX`) with uniqueness retry | |
| Fixed pipeline: NEW → CONTACTED → QUALIFIED → SITE_VISIT_SCHEDULED → SITE_VISIT_COMPLETED → NEGOTIATION → BOOKED → CLOSED_WON / CLOSED_LOST | Transition guard (BR-C02); privileged roles may jump stages |
| Stage change endpoint `PATCH /api/v1/inquiries/:id/stage` | BR-C03 (Won needs property or reason), BR-C04 (Lost needs reason); history + activity written |
| Assignment `POST /api/v1/inquiries/:id/assign` | Validates employee tenant membership; history + activity |
| Notes `POST/GET /api/v1/inquiries/:id/notes` | |
| Follow-ups `POST/GET /api/v1/inquiries/:id/followups` + `PATCH .../:followupId` | Types: call/meeting/whatsapp/site_visit/email; statuses pending/completed/missed/rescheduled |
| Site visits `POST/GET /api/v1/inquiries/:id/site-visits` + `PATCH .../:visitId` | Statuses scheduled/completed/cancelled/no_show; complete writes activity |
| Timeline `GET /api/v1/inquiries/:id/history` | Combines history + activity events |
| Lead sources `GET/POST /api/v1/lead-sources` + `PATCH /api/v1/lead-sources/:id` | Default sources seeded per tenant |
| Duplicate detection (BR-C01) | Same phone + open stage within 30 days; `override_duplicate` to bypass |
| Budget validation (BR-C08) | `budget_max >= budget_min` |
| Lead score field (0–100) | Manual now; AI agent will update later (deferred) |
| Metrics service `GET /api/v1/inquiries/metrics` | Total leads, qualified, site visits, won, lost, conversion rate, by-stage, top performer |
| RBAC enforced at API (guards/permissions) **and** service (scope resolution) | full-access / team / assigned-only |
| Permission seeds + role mappings + new `telecaller` role | `crm.inquiries.*`, `crm.notes.create`, `crm.followups.*`, `crm.sitevisits.*`, `crm.lead_sources.*` |
| Audit log on create/update/delete/stage/assign/note/followup/site-visit/lead-source | `AuditService` |

**Admin UI — `frontend/app/(dashboard)/inquiries/`, `/pipeline`, `/lead-sources`**

| Item | Route |
|------|-------|
| Inquiry listing (search, stage/source/priority/temperature/assignee/property/date filters, pagination, sort) | `/inquiries` |
| Create page | `/inquiries/new` |
| Edit page | `/inquiries/[id]/edit` |
| Detail page (overview, follow-ups, site visits, notes, timeline) | `/inquiries/[id]` |
| Assignment / Follow-up / Site visit / Change-stage modals | inline on detail |
| Kanban pipeline board (native drag-and-drop → stage change + history) | `/pipeline` |
| Lead source management (create, activate/deactivate) | `/lead-sources` |
| Timeline component (activity + history merged) | inline on detail |
| Permission-gated nav + action buttons | `crm.*` |

**Tests — `backend/src/modules/crm/crm.service.spec.ts`**

| Suite | Coverage |
|-------|----------|
| RBAC scope | full-access / manager-team / executive-assigned / telecaller / no-employee |
| Access enforcement | out-of-scope 404, allowed access |
| Create | budget BR-C08, duplicate BR-C01, override, invalid links, audit |
| Stage workflow | valid/invalid transitions, manager jump, Won BR-C03, Lost BR-C04 |
| Assignment | invalid employee, success + history |
| Follow-ups & site visits | create + status updates |
| Soft delete & list | audit, scope + pagination |
| Lead sources & metrics | duplicate name, conversion math |
| **Result** | **29 CRM tests passing (48 total)** (`npm test`) |

### 🟡 Deferred (by instruction / later phase)

| Item | Notes |
|------|-------|
| Analytics dashboard UI | Metrics service methods ready; dashboard is Phase 4 |
| Public inquiry submission form | Web inquiry capture deferred |
| Follow-up reminders / notifications | ✅ Phase 5 automation + delayed reminder queue |
| AI lead scoring | `lead_score` stored; AI update is Phase 8 |
| DB-backed integration/e2e tests | Service unit tests cover business logic; live-Postgres e2e deferred to CI |

### ❌ Out of scope (by instruction)

Chat, AI Agent, Billing, Analytics dashboard, Notifications — intentionally not started in Phase 3.

---

## 12. Phase 4 — Dashboard & Analytics

**Status:** Business-visibility layer. Backend analytics module + role-aware admin dashboards production-grade. No new core tables — reuses Phase 1–3 data (`organizations`, `properties`, `inquiries`, `site_visits`, `employees`).

### ✅ Completed

**Backend — `backend/src/modules/analytics/`**

| Item | Notes |
|------|-------|
| `AnalyticsModule` (service / repository / cache / 2 controllers) | All aggregation logic in `AnalyticsService`; controllers stay thin |
| Single dashboard aggregation endpoint `GET /api/v1/analytics/dashboard` | One round trip → properties + leads + revenue + funnel + sources + monthly trends + team table |
| KPI/chart endpoints | `/analytics/leads`, `/properties`, `/employees`, `/funnel`, `/sources`, `/conversions`, `/revenue` |
| Platform (Super Admin) endpoint `GET /api/v1/platform/analytics/dashboard` | Cross-tenant — orgs, users, MRR/ARR, monthly growth, plan tiers, platform health. No `TenantGuard` |
| RBAC scope resolution in service | full-access (`all`) → org-wide; `sales_manager` → team (self + reports); executive/telecaller → assigned-only; Client → no access |
| Time filters | `today`, `7d`, `30d`, `90d`, `custom` (date_from/date_to) via `AnalyticsQueryDto` |
| Optimized aggregate queries (no N+1) | Prisma `groupBy` / `count`; employee table = batched group-bys + single name lookup; monthly trends = parameterized raw SQL (`date_trunc`, `Prisma.sql`) |
| Revenue recognition on close date (`closed_at`) | Won-deal value = property price → budget_max → budget_min |
| In-memory TTL cache (`AnalyticsCacheService`) | 60s wrap; key by tenant + scope + range; Redis-ready interface |
| Permission seeds + role mappings | `analytics.read` (org/team/assigned roles) + `platform.analytics.read` (super_admin) |

**Admin UI — `frontend/app/(dashboard)/` + `frontend/components/analytics/`**

| Item | Route / file |
|------|------|
| Role-aware Dashboard Home (Super Admin vs Org/Employee) | `/dashboard` |
| Analytics page (full charts + custom range) | `/analytics` |
| Team Performance page (leaderboard) | `/performance` |
| Components: `KPICard`, `MetricCard`, `ChartCard`, `RangeFilter`, `FunnelChart`, `LeadSourceChart`, `PropertyStatusChart`, `ConversionChart` + `MonthlyLeadsChart`, `EmployeePerformanceTable` | `components/analytics/` |
| Skeleton + empty states; responsive grids | `chart-card.tsx` (`Skeleton`, `KpiSkeletonGrid`, `EmptyState`) |
| Dependency-free charts (pure CSS/SVG) | No chart library added |
| INR (lakh/crore) + number/percent formatters | `lib/analytics.ts` |
| Permission-gated nav (Analytics / Performance) | `components/admin/admin-shell.tsx` |

**Tests — `backend/src/modules/analytics/analytics.service.spec.ts`**

| Suite | Coverage |
|-------|----------|
| RBAC visibility | org-wide / team / assigned scope resolution; no-employee fallback |
| Time ranges | today / 7d / 30d / 90d / custom |
| KPI math | lead conversion, qualified roll-up, property snapshot, funnel monotonicity, source coalescing/sort, revenue fallbacks + close-date ranging |
| Dashboard composition | performance table hidden for assigned scope, shown for managers; full shape in one call |
| Platform analytics | org status split, totals, MRR/ARR from tiers |
| **Result** | **19 analytics tests passing (67 total)** (`npm test`) |

### 🟡 Deferred (by instruction / later phase)

| Item | Notes |
|------|-------|
| Redis cache backend | In-memory TTL cache ships now; swap to Redis via the same `wrap()` interface |
| DB-backed integration/e2e for analytics APIs | Service unit tests cover the aggregation + RBAC logic; live-Postgres e2e deferred to CI |
| Export (CSV/PDF) of reports | Not requested in Phase 4 |

### ❌ Out of scope (by instruction)

Notifications, Chat, Billing, AI Agent — intentionally not started in Phase 4.

---

## 12. Phase 5 — Notifications & Automation Engine

**Status:** Operational heartbeat of the CRM. Backend queue + automation + realtime complete; admin UI bell/dropdown/center/settings shipped. Billing subscription-expiring event is stubbed (no billing module yet).

### ✅ Completed

**Backend — `backend/src/modules/notifications/` + shared infra**

| Item | Notes |
|------|-------|
| Prisma models: `notifications`, `notification_preferences`, `notification_templates`, `notification_delivery_logs`, `notification_queue` | Migration `20260609140000_add_notifications_domain` |
| Domain event bus (`DomainEventBus`) + `DOMAIN_EVENTS` keys | `backend/src/events/` |
| Queue abstraction (`QueueService`) — BullMQ when Redis configured, in-memory fallback otherwise | `backend/src/jobs/` |
| Email provider interface + dev logger + production stub | `backend/src/providers/email/` |
| Automation engine (`AutomationService`) — `AUTOMATION_RULES` + recipient strategies | Subscribes to all domain events |
| Notification dispatcher (in-app persist + realtime + email enqueue) | `NotificationDispatcherService` |
| Socket.io gateway (`/notifications` namespace, JWT auth, `user:{id}` rooms) | `NotificationsGateway` |
| REST APIs | `GET/PATCH /notifications`, preferences, admin templates |
| CRM emitters | inquiry created/assigned, follow-up due/missed, site visit scheduled/reminder |
| Property emitters | assigned, status changed |
| Employee invite emitter | `USER_INVITED` on `createEmployee` |
| Permission seeds | `notifications.read`, `notifications.templates.manage` |

**Admin UI — `frontend/components/notifications/` + routes**

| Item | Route / file |
|------|------|
| Navbar bell + unread badge + dropdown (Today/Yesterday/Older) | `notification-bell.tsx`, `notification-dropdown.tsx` |
| Notification center (filters, pagination, mark all read) | `/notifications` |
| Notification detail view | `/notifications/[id]` |
| Notification settings (per-event in-app / email toggles) | `/settings/notifications` |
| Realtime client (`socket.io-client`) | `hooks/use-notifications.ts` |

**Tests**

| Suite | Coverage |
|-------|----------|
| `template-renderer.spec.ts` | Interpolation, resolution order |
| `notification-preferences.service.spec.ts` | Defaults, merge, update |
| `automation.service.spec.ts` | Recipient strategies, exclude actor, dedup |
| `notifications.service.spec.ts` | Dispatch queues, mark read, RBAC scope |
| `notification-templates.service.spec.ts` | CRUD + conflict |
| `queue.service.spec.ts` | In-memory driver, delayed jobs |
| **Result** | **108 tests passing** (`npm test` in `backend/`) |

### 🟡 Deferred / known limitations

| Item | Notes |
|------|-------|
| Production email ESP (SES/SendGrid) | `ProductionEmailProvider` throws until integrated |
| `SUBSCRIPTION_EXPIRING` automation | Event key + rule exist; no billing emitter yet |
| WhatsApp channel | Out of MVP scope (email + in-app only) |
| DB-backed notification integration/e2e | Unit tests cover service logic; live Postgres e2e deferred |
| `GET /notifications/:id` | Detail page lists recent notifications and finds by id |

---

## Phase 6 — Live Chat & Omnichannel Foundation (Jun 2026)

### ✅ Backend

| Area | Status |
|------|--------|
| Prisma models + migration `20260609150000_add_chat_domain` | ✅ |
| `ChatModule` — controller, service, repository, DTOs | ✅ |
| RBAC scope (full / team / assigned) | ✅ |
| Socket.io `/chat` gateway (messages, typing, assign, close) | ✅ |
| Notification domain events + automation rules | ✅ |
| CRM inquiry conversion (`POST …/convert-inquiry`) | ✅ |
| Attachment upload via `StorageService.saveChatAttachment` | ✅ |
| Unit tests `chat.service.spec.ts` (7 cases) | ✅ |

### ✅ Admin UI

| Screen | Path |
|--------|------|
| Chat Inbox (list + thread + composer + sidebar) | `/chat` |
| Assignment modal | inline |
| Unread badge in list + socket updates | ✅ |

### 🟡 Deferred

| Item | Notes |
|------|-------|
| Public website chat widget | HMAC client token helpers in service; no embed UI yet |
| WhatsApp / AI agent channels | Foundation only (string enums + extensible schema) |
| `@mentions` | Notification type reserved; not implemented |
| Full integration/e2e with live Postgres | Unit tests only in CI |

### ❌ Out of scope (by instruction)

AI Agent runtime and WhatsApp Business API — not started.

---

## Phase 7 — Billing & Subscription Platform (Jun 2026)

### ✅ Backend

| Area | Status |
|------|--------|
| Prisma models + migration `20260610110000_add_billing_domain` | ✅ |
| Plan seed updates: Starter, Pro, Enterprise with storage limits | ✅ |
| `BillingModule` — controller, service, repository, DTOs | ✅ |
| Payment provider abstraction: `PaymentProvider`, `MockProvider`, `RazorpayProvider` | ✅ |
| Tenant APIs: plans, subscription, subscribe, change-plan, cancel, invoices, usage | ✅ |
| Razorpay webhook endpoint with HMAC validation + idempotency table | ✅ |
| Invoice + payment + payment attempt records | ✅ |
| Billing notification events: trial ending, payment failed, invoice generated, renewed, plan changed | ✅ |
| Super Admin revenue metrics: MRR, ARR, churn, plan mix, subscription health | ✅ |
| Existing property/employee quota lookups aligned to `starter` / `pro` / `enterprise` | ✅ |

### ✅ Admin UI

| Screen | Path |
|--------|------|
| Billing dashboard | `/billing` |
| Plan comparison + upgrade/downgrade | `/billing/plans` |
| Subscription management + cancel at period end | `/billing/subscription` |
| Invoices | `/billing/invoices` |
| Usage limits | `/billing/usage` |
| Sidebar navigation gated by `billing.subscription.read` | ✅ |

### 🟡 Deferred / known limitations

| Item | Notes |
|------|-------|
| Live Razorpay subscription creation | Provider abstraction is in place; current `RazorpayProvider` returns a hosted/stub URL unless Razorpay credentials are configured and full API calls are added. |
| Invoice PDF generation | `pdf_url` is stored; PDF rendering/upload worker is deferred. |
| Redis plan-limit cache | DB-backed limits ship now; Redis cache seam remains documented. |
| DB-backed billing integration/e2e | Unit/integration coverage should be expanded around live Postgres + webhook raw-body verification. |
| AI minutes enforcement | Schema/usage field exists; AI Agent phase is intentionally not implemented. |

---

## Phase 8 — Public Website & SEO Platform (Jun 2026)

### ✅ Shipped

| Area | Status |
|------|--------|
| Public homepage | `/` buyer-facing hero search + featured listings |
| Listing grid | `/listings?tenant={slug}` now ISR-backed and links to canonical SEO URLs |
| SEO city hubs | `/buy/[city]`, `/rent/[city]`, `/commercial/[city]` |
| SEO property details | `/buy/[city]/[slug]`, `/rent/[city]/[slug]`, `/commercial/[city]/[slug]` |
| Legacy detail compatibility | `/listings/[slug]?tenant={slug}` reuses the same public detail component |
| Public inquiry capture | `POST /api/v1/public/{tenant_slug}/inquiries` creates CRM inquiries with `source_name = Website` |
| SEO metadata | Canonical, Open Graph, Twitter card, `RealEstateListing` JSON-LD |
| Crawler support | `/sitemap.xml`, `/robots.txt` |
| Static public pages | `/about`, `/contact`, `/privacy`, `/terms` |

### Validation

| Check | Result |
|-------|--------|
| Backend build | ✅ `npm --workspace backend run build` |
| Frontend build | ✅ `npm --workspace frontend run build` |
| Backend tests | ✅ `npm --workspace backend run test -- --runInBand` — 11 suites / 118 tests passing |

### Known limitations

| Item | Notes |
|------|-------|
| Admin website settings | No dedicated Website Settings / SEO Settings / Brand Settings UI yet; current branding is mostly static with tenant query fallback. |
| Custom domains | Sitemap can infer subdomain host labels, but full custom-domain lookup/middleware remains deferred. |
| Area/facet programmatic SEO | City hubs shipped; area pages, BHK pages, and content quality gates need backed data before indexing at scale. |
| Public chat widget | Property pages expose a WhatsApp CTA; first-party public chat embed is deferred. |
| Public analytics ingestion | Internal analytics exists; public page view/conversion event ingestion is not yet wired. |

---

## Phase 9 — Enterprise + White Label Platform (Jun 2026)

**Status:** Enterprise readiness layer for agencies, builders, franchises and white-label resellers. Backend settings/domains/white-label/public-analytics modules + admin UI shipped. AI Agent and Mobile Apps intentionally **not** built in this phase.

### ✅ Backend — `backend/src/modules/settings/` + `public-analytics/` + audit export

| Area | Status |
|------|--------|
| Prisma models: `tenant_settings`, `custom_domains`, `public_analytics_events` | ✅ Migration `20260610160000_add_enterprise_platform` |
| `SettingsModule` — controller, domains controller, public-settings controller, service, repository | ✅ |
| Settings stored one row per category (`branding`, `seo`, `website`, `features`, `configuration`, `white_label`) merged over DB-driven defaults | ✅ |
| `GET /api/v1/settings` + per-category `GET/PATCH` (branding, seo, website, features, configuration, white-label) | ✅ |
| `deepMerge` for nested JSON settings (explicit `null` clears) | ✅ |
| `FeatureFlagsService` — DB-resolved flags, no hard-coded values | ✅ |
| `TenantConfigService` — timezone/currency/locale/business hours, central resolver | ✅ |
| Custom domains: `GET/POST /settings/domains`, `GET/PATCH/DELETE /settings/domains/:id`, `POST /settings/domains/:id/verify` | ✅ |
| Domain verification token + DNS records (TXT verify + CNAME route); simulated DNS lookup | ✅ |
| Public (unauthenticated) settings: `GET /api/v1/public/settings?tenant={slug}` (branding/website/seo/white-label) | ✅ |
| Advanced audit logs: filters (action, entity, actor email, entity id, date range) + `GET /api/v1/audit-logs/export` CSV (RFC 4180 escaped) | ✅ |
| `PublicAnalyticsModule` — anonymous tracking `POST /api/v1/public/analytics/track` + dashboard `GET /api/v1/analytics/public` | ✅ |
| Public analytics: IP hashing for privacy, time-range resolution, conversion-rate math, top pages/sources/referrers/properties | ✅ |
| In-memory, Redis-shaped TTL caches (`SettingsCacheService`, `PublicAnalyticsCacheService`) with write invalidation | ✅ |
| RBAC: `settings.read`, `settings.{branding,seo,website,configuration,domains,features,whitelabel}.manage`, `audit.logs.export`, `analytics.public.read` | ✅ Seeded + role-mapped |
| Audit write on every settings/domain mutation (before/after, IP, user agent) | ✅ |

### ✅ Admin UI — `frontend/app/(dashboard)/settings/` + `lib/settings.ts`

| Screen | Path |
|--------|------|
| Settings hub (permission-gated cards) | `/settings` |
| Branding (logo, favicon, colors, typography) | `/settings/branding` |
| Website content (hero, contact, social, footer) | `/settings/website` |
| SEO (meta, OG, Twitter, robots, sitemap) | `/settings/seo` |
| Feature flags (per-tenant toggles) | `/settings/features` |
| Configuration (timezone, currency, locale, formats) | `/settings/configuration` |
| White label (hide branding, custom logo/colors/sender, custom login) | `/settings/white-label` |
| Custom domains (add/verify/remove + DNS records + SSL/verification status) | `/settings/domains` |
| Public analytics dashboard (range filter, totals, conversions, top lists) | `/settings/public-analytics` |
| Audit logs — advanced filters + CSV export | `/audit-logs` |
| Settings nav entry gated by `settings.read` | `components/admin/admin-shell.tsx` |

### ✅ Tests — backend unit specs

| Suite | Coverage |
|-------|----------|
| `settings.service.spec.ts` | `deepMerge`, getCategory (cached), updateCategory (audit + invalidate), public settings |
| `feature-flags.service.spec.ts` | flag resolution + defaults + `isEnabled` |
| `tenant-config.service.spec.ts` | configuration merge, currency, timezone |
| `domains.service.spec.ts` | create, verify (mocked DNS), update, remove |
| `audit.service.spec.ts` | `csvCell` escaping + `exportCsv` |
| `public-analytics.service.spec.ts` | track (IP hash, unknown-tenant no-op), resolveRange, dashboard conversions |

### 🟡 Deferred / known limitations

| Item | Notes |
|------|-------|
| Real DNS/SSL provisioning | `verify` uses a simulated TXT lookup; production needs a real resolver + ACME/SSL issuance and host→tenant routing middleware. |
| Redis cache backend | In-memory TTL caches ship now; swap to Redis via the same `wrap()`/`invalidate()` interface. |
| DB-backed settings/domains/audit integration e2e | Service unit tests cover logic; live-Postgres API e2e deferred to CI. |
| Public website consumption of settings | Settings + public settings API are live; wiring the public site to render tenant branding/SEO end-to-end is incremental. |
| Asset uploads for logos/favicons | Settings store URLs; a dedicated upload widget reuses the existing `StorageService` and is incremental. |

### ❌ Out of scope (by instruction)

AI Agent and Mobile Apps — intentionally not started in Phase 9.
