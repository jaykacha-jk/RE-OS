# RE-OS — Project Backlog

**Date:** 2026-06-11 · Derived from code-verified audit (`PROJECT_AUDIT_REPORT.md`).
**Priorities:** P0 launch blocker · P1 critical · P2 important · P3 nice-to-have · P4 future.
**Estimates** are engineer-hours for a senior full-stack dev. **Impact** is Low/Med/High.

---

## P0 — Launch Blockers (must close before charging any agency)

| ID | Module | Item | Est (h) | Business Impact | Technical Impact |
|----|--------|------|:------:|-----------------|------------------|
| ✅ P0-1 | DevOps | CI/CD pipeline: lint + test + build on every PR (GitHub Actions); block merge on failure | 0 | High — quality gate, prevents regressions | High |
| ✅ P0-2 | DevOps | Backend + frontend **Dockerfiles**; deployable images; staging compose environment with Postgres/Redis/migrate/api/frontend services | 0 | High — cannot ship without it | High |
| ✅ P0-3 | Billing | Razorpay webhook: verify HMAC over **raw body**, `crypto.timingSafeEqual`, mandatory secret, idempotency marks processed **only on success** | 0 | High — revenue integrity, prevents double-activation | High |
| ✅ P0-4 | Auth/Notifications | Wire production transactional email (Resend) → reset-password, invites, billing emails | 0 | High — onboarding & account recovery broken | Med |
| ✅ P0-5 | Security/Testing | Run cross-tenant isolation e2e tests against live Postgres in CI (`tenant-isolation.live-db.e2e-spec.ts`) | 0 | High — prevents catastrophic data leak | High |
| ✅ P0-6 | DevOps | Automated Postgres backups + restore runbook (`scripts/db-backup.sh`, `scripts/db-restore.sh`, `docs/BACKUP_RUNBOOK.md`, compose `backup` service) | 0 | High — data durability | Med |
| P0-7 | DevOps | Default to **Redis-backed** queue + cache outside tests/dev (jobs/caches currently lost on restart) | 12 | High — reliability | High |
| ✅ P0-8 | DevOps | Monitoring/error tracking (Sentry, optional) + structured JSON request logs / request-id correlation | 0 | High — operability | Med |
| | | **P0 remaining subtotal** | **~12h (P0-7 only)** | | |

---

## P1 — Critical (within 30–60 days)

| ID | Module | Item | Est (h) | Impact | Technical |
|----|--------|------|:------:|--------|-----------|
| P1-1 | Billing | Durable scheduler (`@nestjs/schedule`): trial→expire, past_due→suspended (BR-T02), missed-followup detection | 16 | High | High |
| P1-2 | Security | Global suspended-org **read-only guard** on all write endpoints (currently only 3 read paths) | 10 | High | Med |
| P1-3 | RBAC | Global auth/permissions guard strategy or lint rule forbidding endpoints without `@RequirePermissions` | 10 | High | Med |
| ✅ P1-4 | Billing | Live Razorpay subscription creation (replace stub URL) | 0 | High | High |
| P1-5 | Frontend | Access-token **refresh flow** (refresh_token stored but unused → sessions break on expiry) | 10 | High | Med |
| P1-6 | Security | Move session token from `localStorage` to httpOnly cookie (XSS hardening) | 14 | Med | Med |
| P1-7 | Testing | API integration/E2E suite (auth, properties, CRM, billing webhook) on live Postgres | 30 | High | High |
| P1-8 | Tenant DB | Mutations use tenant-scoped `updateMany`/`deleteMany`; tenant-scope subordinate-employee lookups | 12 | Med | Med |
| P1-9 | Billing | Invoice PDF generation worker → store + email | 14 | Med | Med |
| P1-10 | Frontend | Toast/notification system + standardized error handling | 8 | Med | Low |
| | | **P1 remaining subtotal** | **~124h** | | |

---

## P2 — Important (60–90 days)

| ID | Module | Item | Est (h) | Impact | Technical |
|----|--------|------|:------:|--------|-----------|
| P2-1 | Frontend | `react-hook-form` + `zod` schema validation across forms | 24 | Med | Med |
| P2-2 | Frontend | OpenAPI→TypeScript client generation from `/api/v1/openapi.json` | 10 | Med | Low |
| P2-3 | White Label | Real DNS/SSL provisioning (ACME) + host→tenant routing middleware | 30 | Med | High |
| P2-4 | Settings | Public website renders tenant branding/SEO end-to-end | 16 | Med | Med |
| P2-5 | Chat | Public chat realtime socket auth + transcript polish (REST-backed widget exists) | 10 | Med | Med |
| P2-6 | Public Web | Buyer accounts: registration/profile + saved properties/favorites | 30 | Med | Med |
| P2-7 | DB | `audit_logs` indexes for action/entity/actor filters + export pagination | 6 | Med | Low |
| P2-8 | Analytics/Settings | Swap in-memory caches → Redis (interface already shaped) | 8 | Med | Low |
| P2-9 | Employees | BR-E02 reassign-on-delete; add `created_by`/`updated_by` to users/employees | 8 | Low | Low |
| P2-10 | A11y | Label `htmlFor` association, ARIA, keyboard-accessible pipeline | 16 | Med | Med |
| P2-11 | Frontend | Resolve duplicate Tailwind config (`.js` vs `.ts`) | 2 | Low | Low |
| | | **P2 subtotal** | **~174h** | | |

---

## P3 — Nice to Have

| ID | Module | Item | Est (h) | Impact |
|----|--------|------|:------:|--------|
| P3-1 | SEO | Area/facet programmatic pages + `/listings` route metadata | 20 | Med |
| P3-2 | Frontend | INR/+91 phone formatting helpers everywhere | 6 | Low |
| P3-3 | Platform | Dedicated create-org page (currently inline) | 4 | Low |
| P3-4 | Property | Drag-reorder image UI + upload widget (API exists) | 10 | Low |
| P3-5 | Analytics | CSV/PDF export of reports | 12 | Low |
| P3-6 | Chat | `@mentions` (notification type reserved) | 8 | Low |
| P3-7 | Frontend | Adopt shadcn/ui component library for consistency | 24 | Low |

---

## P4 — Future / Scale

| ID | Module | Item | Est (h) | Impact |
|----|--------|------|:------:|--------|
| P4-1 | AI | Real telephony (Twilio/Exotel) behind existing provider abstraction | 40 | High (AI GTM) |
| P4-2 | AI | pgvector + ANN index for knowledge base (replace JSON cosine) | 24 | Med |
| P4-3 | AI | LLM cost guards, TRAI/consent compliance for voice | 24 | High (legal) |
| P4-4 | DB | Partitioning/archival for messages, activities, analytics, ai_usage | 30 | Med |
| P4-5 | Security | Postgres Row-Level Security as defense-in-depth for tenancy | 40 | High |
| P4-6 | Platform | Load/perf testing harness; horizontal scaling + read replicas | 30 | Med |
| P4-7 | Notifications | WhatsApp channel (out of MVP) | 30 | Med |
| P4-8 | Secrets | AWS Secrets Manager integration (per SECURITY.md) | 12 | Med |

---

## Roadmap Rollup

| Window | Focus | Items | Est |
|--------|-------|-------|-----|
| **30 days** | Production hardening (safe to charge 1 agency) | Remaining P0 | ~40h |
| **60 days** | Sustainable for 10–50 agencies | Remaining P1 | ~124h |
| **90 days** | Scale & polish, buyer features | P2 + key P3 | ~190h |

**Recommended next phase:** **Phase 11 — Production Hardening.** Freeze new product surface; close remaining P0 + top P1 before GA. Total to GA-safe ≈ **164h (~4 focused weeks)**.
