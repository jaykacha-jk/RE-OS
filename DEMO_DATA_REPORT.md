# Demo Data Report — Phase 11A

Realistic, multi-tenant demo data so every redesigned surface (dashboard, charts,
tables, activity feed) is populated for investor/customer walkthroughs.

## Validation Run

```
cd backend
npx prisma migrate deploy      # 9 migrations — "No pending migrations to apply"
npm run build                  # compiles dist/ (seed requires it)
node prisma/seed.js            # "Seed completed"
```

- ✅ **All migrations applied** (9/9, schema up to date).
- ✅ **Seed completed** without errors.
- ✅ **Dashboard, charts, and tables populate** for both the super-admin (platform) and tenant (org) views.

> The seed is idempotent: it upserts base entities (roles, permissions, plans,
> super admin, demo org) and rebuilds per-tenant demo content via
> `cleanupDemoTenant()` before reseeding, so re-running yields stable counts.

## Seeded Volumes (verified via live DB count)

| Entity | Count | Notes |
|--------|------:|-------|
| Organizations | 5 | Demo Realty + 4 Gujarat agencies (starter/pro/enterprise tiers) |
| Users | 53 | Super admin + owners/sales/telecallers across orgs |
| Employees | 52 | Mapped to users with departments & employee codes |
| Properties | 500 | 100 per org — villas, flats, plots, offices, shops, warehouses |
| Property images | 500 | Cover image per property (Unsplash) |
| Inquiries | 300 | 60 per org, spread across all 9 pipeline stages |
| Inquiry follow-ups | 300 | Pending/completed, call/WhatsApp/visit/meeting |
| Site visits | 100 | Scheduled & completed |
| Conversations | 100 | Website + WhatsApp threads |
| Messages | 300 | Client/employee threads |
| Subscriptions | 5 | One per org, trial/active |
| Invoices | 15 | 3 per org, paid/open with 18% GST |
| Notifications | 100 | Drives the dashboard **activity feed** |
| Public analytics events | 100 | page_view / property_view / click / conversion |
| Lead sources | 35 | 7 per org (Website, Portal, WhatsApp, FB, Google Ads, Referral, Walk-in) |
| AI knowledge docs | 4 | RAG-retrievable with mock embeddings |
| AI agents | 1 | Demo voice agent (mock provider) |
| Subscription plans | 4 | starter / pro / enterprise (+1) |
| Roles | 6 | super_admin → telecaller |
| Permissions | 68 | Full RBAC matrix |

### Distribution (drives chart realism)

**Inquiry pipeline stages** (balanced funnel):
`NEW 35 · CONTACTED 35 · QUALIFIED 35 · SITE_VISIT_SCHEDULED 35 · SITE_VISIT_COMPLETED 35 · NEGOTIATION 35 · BOOKED 30 · CLOSED_WON 30 · CLOSED_LOST 30`

**Property status** (inventory snapshot):
`published 255 · reserved 85 · sold 80 · draft 80`

These distributions ensure the funnel chart, lead-source donut, property-status
bars, monthly-conversion combo chart, and team-performance table all render with
meaningful, non-degenerate data.

## Demo Logins (after seed)

| Role | Email | Password | Tenant slug |
|------|-------|----------|-------------|
| Super Admin | `super@reos.dev` | `ChangeMe123!` | — |
| Org Owner | `owner@demo.realty` | `ChangeMe123!` | `demo` |
| Sales Exec | `sales@demo.realty` | `ChangeMe123!` | `demo` |

## Coverage vs. Requirements

| Requested | Status |
|-----------|--------|
| Organizations | ✅ 5 orgs, 3 tiers, custom domains |
| Properties | ✅ 500, all categories/statuses, images, amenities, tags, assignments |
| CRM | ✅ 300 inquiries, activities, follow-ups, site visits |
| Analytics | ✅ 100 public events + derived dashboard metrics |
| Billing | ✅ subscriptions + 15 invoices (GST), usage counters synced |
| Chat | ✅ 100 conversations, 300 messages, assignments |
| Notifications | ✅ 100 notifications (powers the activity feed) |
