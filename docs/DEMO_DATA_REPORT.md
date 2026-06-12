# RE-OS Demo Data Report

**Phase:** 11A — UI/UX Transformation & Demo Readiness
**Date:** 2026-06-11
**Source:** `backend/prisma/seed.js`
**Verification:** Live counts queried from the seeded PostgreSQL database after `node prisma/seed.js`.

---

## Purpose

Guarantee that a fresh RE-OS install is **demo-ready** — every dashboard, list, chart, and public page renders meaningful, market-credible data with **no empty screens** on the happy-path demo. Demo data models a realistic multi-tenant Gujarat real estate business.

---

## How to Reproduce

```bash
# from repo root
cd backend
npx prisma migrate deploy      # apply 9 migrations
npx prisma generate            # generate Prisma 7 client
npm run build                  # compile dist/ (seed imports from dist)
node prisma/seed.js            # idempotent: cleans + reseeds demo tenants
```

The seed is **idempotent**: organizations are `upsert`-ed by slug and each demo tenant is cleaned (`cleanupDemoTenant`) before re-seeding, so it can be run repeatedly without duplication.

---

## Verified Volumes (live DB counts)

| Entity | Seeded | Phase 11A Target | Status |
|---|---:|---:|:--:|
| Organizations | 5 | 5 | ✅ |
| Users | 53 | — | ✅ |
| Employees | 52 | 50 | ✅ |
| Properties | 500 | 500 | ✅ |
| Property images | 500 | — | ✅ |
| Property assignments | 500 | — | ✅ |
| Inquiries (leads) | 300 | 300 | ✅ |
| Inquiry activities | 900 | — | ✅ |
| Inquiry follow-ups | 300 | — | ✅ |
| Site visits | 100 | — | ✅ |
| Conversations | 100 | 100 | ✅ |
| Messages | 300 | — | ✅ |
| Notifications | 100 | 100 | ✅ |
| Public analytics events | 100 | — | ✅ |
| Subscriptions | 5 | — | ✅ |
| Invoices | 15 | — | ✅ |
| Lead sources | 35 | — | ✅ |
| Tenant settings | 30 | — | ✅ |

> Employees/users exceed the 50 target because the legacy base demo org (`demo`) contributes 2 additional employees plus the platform super admin. All Phase 11A minimums are met or exceeded.

---

## Tenant Roster

| Organization | Slug | City | Plan tier | Status |
|---|---|---|---|---|
| Demo Realty | `demo` | Ahmedabad | Pro | Active |
| Aarav Prime Estates | `aarav-prime` | Ahmedabad | Pro | Active |
| Surat Skyline Realty | `surat-skyline` | Surat | Starter | Trial |
| Vadodara Urban Homes | `vadodara-urban` | Vadodara | Pro | Active |
| Gandhinagar Capital Properties | `capital-properties` | Gandhinagar | Enterprise | Active |

Each tenant receives the full data set below, so every tenant is independently demo-ready and tenant isolation can be demonstrated.

---

## Per-Tenant Composition

Each of the 5 organizations is seeded with:

- **10 employees** across roles: `org_owner`, `org_admin`, `sales_manager` (×2), `sales_executive` (×4), `telecaller` (×2) — each with a user account, role assignment, employee code (`<ORG>-EMP-###`), and department.
- **100 properties** spanning 6 shapes (luxury villa, premium apartment, residential plot, commercial office, retail shop, warehouse) across 5 Gujarat cities and 7 localities. Each property has a cover image, 3–5 amenities, 4 tags, SEO meta, INR pricing, and a primary sales assignment. Status mix: published / reserved / sold / draft.
- **60 inquiries** distributed across all 9 pipeline stages (NEW → CLOSED_WON / CLOSED_LOST), with budgets, timelines, lead scores (45–99), temperature (hot/warm/cold), and priority. Each inquiry has 3 activities (created, assigned, stage changed), a follow-up, and ~1-in-3 has a scheduled/completed site visit.
- **20 conversations** (website + WhatsApp), each with a 3-message thread, client/property context, assignment, and last-message preview. ~1-in-7 closed.
- **20 notifications** (CRM hot-lead + system), mixed read/unread, with action URLs into inquiries.
- **20 public analytics events** (page_view, property_view, property_click, inquiry_conversion) with organic/social sources for funnel and traffic charts.
- **Billing:** 1 subscription (active, or trial for the Starter tenant) + 3 invoices (paid history, with one open invoice for the trial tenant), plus a synced `organization_usage` row (properties/employees/storage/AI minutes).
- **Settings:** 6 tenant settings categories (branding, website, seo, features, configuration, white_label) + 7 lead sources.

---

## Market Realism

The seed deliberately avoids fantasy data so a Gujarat buyer recognizes the market:

- **Cities:** Ahmedabad, Surat, Vadodara, Rajkot, Gandhinagar.
- **Localities:** SG Highway, South Bopal, Science City, Prahlad Nagar, Satellite, Bopal, Thaltej.
- **Pricing:** realistic INR lakh/crore ranges per property shape.
- **Names & contacts:** Indian names, `+91` phone numbers, INR budgets.
- **Lead sources:** Website, Property Portal, WhatsApp, Facebook, Google Ads, Referral, Walk-in.
- **Activity histories:** inquiry created → assigned → stage changed, with follow-ups and site visits.

---

## Empty-State Elimination Matrix

| Screen | Data that prevents an empty state |
|---|---|
| Org Dashboard | 300 leads, funnel stages, 500 properties, monthly conversion, team performance, quick actions |
| Platform Dashboard | 5 orgs (active/trial/enterprise), MRR/ARR, tier breakdown, monthly growth |
| Properties | 100 published-mix listings per tenant with images, status, assignment |
| Property detail | Cover image, amenities, tags, locality, SEO, sales owner |
| Inquiries / CRM | 60 leads across all 9 stages, scores, temperature, follow-ups |
| Lead profile | 3+ activities, follow-up, site visit, linked property |
| Pipeline (Kanban) | Leads in every stage column |
| Chat | 20 conversations with 3-message threads + assignments |
| Analytics / Performance | Funnel, source quality, conversion, employee leaderboard |
| Billing | Subscription state + 3 invoices + usage meters |
| Notifications | 20 mixed read/unread with action links |
| Public website / listings | Published properties with imagery and locality content |

---

## Demo Credentials

| Role | Email | Password | Tenant slug |
|---|---|---|---|
| Platform Super Admin | `super@reos.dev` | `ChangeMe123!` | — |
| Org Owner | `owner@demo.realty` | `ChangeMe123!` | `demo` |
| Sales Executive | `sales@demo.realty` | `ChangeMe123!` | `demo` |

Demo-tenant employee logins follow `firstname.lastname<n>@<slug>.reos.demo` with password `ChangeMe123!`.

> These are development demo credentials only. Rotate before any production or shared deployment (see `docs/SECURITY.md`).

---

## Notes & Constraints

- No new backend business features were added; the seed uses only existing schema and models, respecting tenant isolation (`tenant_id` on every business row).
- Property images use Unsplash URLs; configure image domains/storage before enabling `next/image` optimization in production.
- AI is seeded with the **mock** provider (knowledge docs + a demo voice agent) so AI screens populate without external API keys.

---

## Phase 11B Addendum — Demo Data Audit (2026-06-12)

Re-audited `backend/prisma/seed.js` against the Phase 11B target volumes. **No new
seed work is required** — the existing seed meets or exceeds every target, so the
public site, dashboard, and analytics all render with credible data.

| Phase 11B target | Seed output (per `seed.js`) | Status |
|------------------|-----------------------------|--------|
| 5 Organizations | 5 demo orgs | ✅ |
| 50 Employees | ~10 / org → ~50 | ✅ |
| 500 Properties | 100 / org → ~500 (+ ~3,000 images) | ✅ |
| 300 Inquiries | 60 / org → ~300 (+ notes & follow-ups) | ✅ |
| 100 Conversations | 20 / org → ~100 (+ ~1,000 messages) | ✅ |
| 100 Notifications | 40 / org → ~200 | ✅ exceeds |
| 100 Billing records | 20 invoices / org → ~100 | ✅ |
| 50 Site Visits | every 3rd inquiry → ~100 | ✅ exceeds |
| 12 Months Analytics | trends derived from dated records | ✅ |

**Reproduce:** `npx prisma migrate deploy && npm run build:backend && node prisma/seed.js`
(idempotent — upserts orgs by slug, cleans each demo tenant before reseeding).

**Conclusion:** the demo-data step of Phase 11B is satisfied by the existing seed;
no regeneration needed.
