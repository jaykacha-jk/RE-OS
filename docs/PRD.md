# RE-OS Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Approved for Phase 1–4 MVP  
**Last Updated:** 2026-06-05

---

## 1. Product Overview

### 1.1 Product Name

Real Estate Operating System (RE-OS)

### 1.2 Vision

A multi-tenant SaaS platform enabling real estate organizations to manage properties, capture and convert leads, coordinate teams, automate follow-ups, and scale revenue with AI-assisted qualification and public SEO property discovery.

### 1.3 Problem Statement

Indian real estate agencies operate on WhatsApp, Excel, and fragmented CRMs. Leads leak between agents, property data is inconsistent, follow-ups are manual, and there is no unified pipeline from inquiry to closure.

### 1.4 Success Metrics (12-month)

| Metric | Target |
|--------|--------|
| Paid organizations | 500 |
| Avg inquiries/org/month | 200+ |
| Lead-to-visit conversion | +25% vs baseline |
| Agent follow-up SLA compliance | 80%+ |
| Monthly churn | < 3% |
| Organic property page impressions | 1M+/month (aggregate) |

---

## 2. User Personas & Roles

| Role | Scope | Primary Goals |
|------|-------|---------------|
| Super Admin | Platform | Onboard orgs, monitor health, billing overrides |
| Organization Owner | Tenant | Revenue, team, subscription |
| Organization Admin | Tenant | Operations, employees, properties |
| Sales Manager | Tenant | Team pipeline, assignments |
| Sales Executive | Tenant | Close assigned leads |
| Telecaller | Tenant | Outbound qualification, AI call triggers |
| Marketing User | Tenant | Listings, SEO content, campaigns |
| Client | Public + portal | Browse, inquire, chat |

---

## 3. Core User Journeys

### 3.1 Super Admin — New Organization

1. Login to platform admin (`superadmin@platform.reos.app`)
2. Dashboard shows pending org requests and platform KPIs
3. **Organizations → Create:** Name, logo, subdomain (`xyz`), tier (Basic/Pro/Enterprise), billing email
4. System provisions tenant, default roles, welcome email to org owner
5. Org admin receives magic link / invite to set password
6. **Result:** Tenant live within 2 minutes; subdomain `xyz.reos.app` or custom domain (Phase 9)

### 3.2 Org Admin — Launch Team & Inventory

1. Login as `admin@xyz.realty`
2. Dashboard: empty state — "Add team" / "Add properties"
3. **Employees → Create:** Name, phone, email, role (Sales Manager, Sales Executive, etc.)
4. **Properties → Bulk import CSV** or manual create (50 listings)
5. Dashboard reflects live inventory count
6. **Result:** Sales team can work assigned inventory

### 3.3 Sales Executive — Lead Conversion

1. Dashboard: "10 new inquiries" widget
2. Open inquiry **Raj Patel**, budget ₹80L, requirement 3BHK SG Highway
3. **AI Agent → Add number** → outbound AI call captures structured requirement
4. **Property → Assign PROP005** to inquiry; status → Site Visit Scheduled
5. **Live Chat:** Client asks "Viewing tomorrow?" → reply with slot
6. Update inquiry stage → Negotiation → Closed Won
7. **Result:** Deal tracked end-to-end; commission/reporting available

### 3.4 Client — Discovery to Inquiry

1. Google search "SG Highway 3BHK Ahmedabad" → lands on `xyz.reos.app/buy/ahmedabad/...`
2. Filter: Buy, Residential, ₹50L–1Cr
3. View property: photos, price, EMI estimate, **Chat** CTA
4. Submit inquiry with budget; optional login for profile
5. **Profile:** inquiry status, scheduled viewing
6. **Result:** Low-friction path without exposing internal CRM data

---

## 4. Module Specifications

### 4.1 Organization Module (Super Admin)

**Listing columns**

| Column | Example | Filterable |
|--------|---------|------------|
| Org ID | ORG-uuid short | No |
| Name | ABC Realty | Yes |
| Domain | abc.reos.app | Yes |
| Status | Active / Suspended | Yes |
| Tier | Pro (₹20k/mo) | Yes |
| Properties | 150 | No |
| Employees | 12 | No |
| Created | 2026-01-01 | Yes |
| Actions | Edit, Suspend | — |

**Create/Edit fields**

| Field | Type | Validation |
|-------|------|------------|
| Name | Text | 2–120 chars, required |
| Logo | File | PNG/JPG, max 2MB |
| Subdomain | Text | Unique, lowercase, `[a-z0-9-]` |
| Tier | Enum | basic, pro, enterprise |
| Billing email | Email | Required |
| Status | Enum | active, suspended, trial |

**Features:** CRUD, usage limits enforcement, subscription linkage, suspend tenant (read-only mode).

**CEO ROI:** Direct revenue via tiers; retention via usage limits tied to value.

---

### 4.2 Employee Module

**Listing columns**

| Column | Example | Filterable |
|--------|---------|------------|
| Emp ID | UUID short | No |
| Name | Krunal Thakkar | Yes |
| Phone | +91-98765xxxxx | Yes |
| Email | k@abc.com | Yes |
| Role | Sales Executive | Yes |
| Status | Active | Yes |
| Joined | 2026-02-01 | Yes |
| Properties assigned | 25 | No |
| Open inquiries | 50 | No |

**Create/Edit fields**

| Field | Type | Notes |
|-------|------|-------|
| Name | Text | Required |
| Phone | E.164 | Unique per tenant |
| Email | Email | Unique per tenant |
| Role | Dropdown | Maps to RBAC role |
| Manager | FK Employee | Optional |
| Permissions | Override matrix | Phase 1+: role default only |

**Restrictions:** Employees cannot delete org; cannot see other tenants; Telecaller cannot delete properties.

---

### 4.3 Property Module

**Types:** Residential, Commercial  
**Categories:** Flat, Villa, Plot, Office, Shop, Warehouse  
**Status:** Draft, Available, Reserved, Sold, Rented, Archived

**Core fields**

| Field | Type | Example |
|-------|------|---------|
| Title | Text | 3BHK Luxury Flat SG Highway |
| Slug | Text | 3bhk-flat-sg-highway (SEO) |
| Type / Category | Enum | Buy Residential |
| Price | Decimal INR | 8500000 |
| Price type | Enum | fixed, negotiable, on_request |
| Location | City, area, lat/lng | Ahmedabad, SG Highway |
| BHK | Int | 3 |
| Area sqft | Decimal | 1450 |
| Amenities | Multi | Gym, Parking, Pool |
| Tags | Multi | Hot, Exclusive |
| Status | Enum | Available |
| Assigned agents | M2M | Employee IDs |

**Media:** Images (ordered), video URL, floor plan PDF (S3).

**Public SEO URL pattern:** `/buy/{city}/{slug}`

**Features:** Advanced filters, map view, assignment, history/audit, bulk CSV import, Elasticsearch sync.

---

### 4.3A Public Website & SEO Module

> **Status: 🟡 Phase 8 foundation implemented.** Frontend routes now support public homepage, listing grid,
> SEO city hubs, canonical property detail URLs, sitemap, robots, and static public pages. Lead forms create CRM
> inquiries through `POST /api/v1/public/{tenant_slug}/inquiries`.

**Public routes**

| Page | Route |
|------|-------|
| Homepage | `/` |
| Listing grid | `/listings?tenant={slug}` |
| Legacy detail | `/listings/{slug}?tenant={slug}` |
| City hubs | `/buy/{city}`, `/rent/{city}`, `/commercial/{city}` |
| Property detail | `/buy/{city}/{slug}`, `/rent/{city}/{slug}`, `/commercial/{city}/{slug}` |
| Static pages | `/about`, `/contact`, `/privacy`, `/terms` |
| Crawlers | `/sitemap.xml`, `/robots.txt` |

**SEO features:** SSR/ISR, canonical URLs, Open Graph, Twitter cards, JSON-LD `RealEstateListing`, and tenant-aware sitemap generation.

**Deferred:** Admin website settings UI, custom-domain resolution, full area/facet programmatic pages, public chat widget embed, and public analytics ingestion.

---

### 4.4 Inquiry / CRM Module

> **Status: ✅ Implemented (Phase 3).** Backend module `backend/src/modules/crm/` + Admin UI
> at `/inquiries`, `/pipeline`, `/lead-sources`. The shipped pipeline is the fixed MVP set
> below (no separate "Property Matched" stage — property linkage is an inquiry field,
> matched at any stage). Stage transitions, assignment, notes, follow-ups, site visits, and
> a merged activity/history timeline are live. Lead score (0–100) is stored manually; AI
> scoring and public web inquiry submission are deferred. See `IMPLEMENTATION_STATUS.md §11`.
>
> **Shipped pipeline:** NEW → CONTACTED → QUALIFIED → SITE_VISIT_SCHEDULED →
> SITE_VISIT_COMPLETED → NEGOTIATION → BOOKED → CLOSED_WON | CLOSED_LOST.

**Listing columns**

| Column | Example | Filterable |
|--------|---------|------------|
| Inquiry ID | INQ-xxx | No |
| Client name | Raj Patel | Yes |
| Phone | +91-98xxx | Yes |
| Email | raj@email.com | Yes |
| Property ref | PROP005 | Yes |
| Budget | ₹80L | Yes |
| Req type | Buy Residential | Yes |
| Stage | New / Site Visit | Yes |
| Assigned | Krunal | Yes |
| Source | Website / AI / Manual | Yes |
| Created | 2026-05-01 | Yes |

**Pipeline stages (default)**

1. New Lead  
2. Contacted  
3. Qualified  
4. Property Matched  
5. Site Visit Scheduled  
6. Site Visit Done  
7. Negotiation  
8. Closed Won  
9. Closed Lost  

**Features:** Kanban, follow-up reminders, activity timeline, call log linkage, duplicate detection (phone).

**Edit fields:** Stage, notes (max 5000), assigned agent, linked properties (multi), lost reason.

---

### 4.5 AI Agent Module

**Add call fields**

| Field | Type |
|-------|------|
| Phone | E.164 required |
| Context notes | Text |
| Linked inquiry | Optional FK |

**Listing columns**

| Column | Example |
|--------|---------|
| Call ID | CALL-xxx |
| Client phone | +91-98xxx |
| Date/time | 2026-05-02 10:00 |
| Duration | 4 min |
| Budget captured | ₹1Cr |
| Requirement summary | 3BHK SG Hwy |
| Interest score | High / Medium / Low |
| Transcript | Link |
| Next action | Follow-up call |

**Features:** Outbound/inbound (provider TBD), recording, Whisper transcript, GPT summary, auto inquiry field population, lead score 0–100.

**Compliance:** Consent flag, recording disclosure script, honor DND registry (India).

---

### 4.6 Dashboard & Analytics Module ✅ (Phase 4 — implemented)

Business-visibility layer so every owner instantly knows the health of their business.
All calculations live in a reusable `AnalyticsService`; the dashboard home loads from a
single aggregation endpoint (`GET /analytics/dashboard`) backed by a 60s cache.

**Three role-aware dashboards**

| Dashboard | Audience | Highlights |
|-----------|----------|------------|
| Super Admin | `super_admin` | Organizations (active/trial/suspended/past_due), MRR/ARR, total users/properties/leads, monthly org growth, plan-tier split, platform health |
| Organization | owner / admin / marketing | Property KPIs (total/active/published/reserved/sold), CRM KPIs (new/qualified/site-visits/won/lost/revenue/conversion %), funnel, sources, monthly conversion, team performance |
| Employee | sales_manager (team) / executive / telecaller (assigned) | The same charts scoped to their team or their own assigned records (no team table for assigned scope) |

**Widgets (role-filtered)**

| Widget | Roles |
|--------|-------|
| Lead KPIs (total/new/qualified/won/lost/conversion) | All internal (scoped) |
| Property status snapshot | Owner, Admin, Marketing, Manager (scoped) |
| Lead funnel (New→Won) | All internal (scoped) |
| Lead sources breakdown | All internal (scoped) |
| Monthly leads / monthly conversion | All internal (scoped) |
| Revenue (won amount, avg deal value) | All internal (scoped) |
| Team performance leaderboard | Owner, Admin, Marketing, Manager |
| Platform KPIs (MRR/ARR, org growth, health) | Super Admin |

**Charts:** Lead Funnel, Property Status, Lead Sources, Monthly Leads, Monthly Conversion,
Employee Performance — all rendered dependency-free (pure CSS/SVG) with skeleton + empty states.

**Time filters:** Today, 7 days, 30 days, 90 days, Custom range.

**Endpoints:** `/analytics/dashboard`, `/leads`, `/properties`, `/employees`, `/funnel`,
`/sources`, `/conversions`, `/revenue` (permission `analytics.read`) +
`/platform/analytics/dashboard` (permission `platform.analytics.read`). RBAC scope
(all / team / assigned) enforced in the service; `client` has no access.

---

### 4.7 Live Chat Module

**Agent inbox columns**

| Column | Example |
|--------|---------|
| Client | Raj (PROP005) |
| Property | 3BHK Flat |
| Last message | "EMI kidhi?" |
| Status | Active · 2m ago |
| Assigned | Krunal |

**Channels (phased):** Website widget foundation (Phase 6 — agent inbox + API; embed deferred), WhatsApp Business API (post-MVP).

**As-built (Phase 6):** Agent chat inbox at `/chat`, REST API under `/api/v1/conversations`, Socket.io namespace `/chat`, CRM inquiry conversion, notification automation for new messages/assignments.

**Features:** Assignment, canned replies, AI suggest reply (Phase 8), conversation history, link to inquiry.

---

### 4.8 Notifications Module

**Status (Phase 5):** ✅ In-app + email (dev provider) + automation engine + realtime bell UI.

| Type | Channel | Trigger | Status |
|------|---------|---------|--------|
| New inquiry | In-app, email | Inquiry created | ✅ |
| Lead assigned | In-app, email | CRM assign | ✅ |
| Follow-up due / missed | In-app, email | Scheduled reminder / status | ✅ |
| Site visit scheduled / reminder | In-app, email | CRM site visit | ✅ |
| Property assigned / status changed | In-app (+ email on assign) | Property module | ✅ |
| User invited | In-app, email | Employee create | ✅ |
| Subscription expiring | In-app, email | Billing webhook | 🟡 rule only (no billing yet) |
| Property match | In-app | Rule engine | ❌ post-MVP |
| WhatsApp | — | — | ❌ Phase 5+ per BR-N02 |

---

### 4.9 Billing Module

> **Status: ✅ Implemented (Phase 7).** Billing APIs, tenant admin UI, plan comparison,
> usage limits, invoices, provider abstraction, and Razorpay webhook processing are live.

Plans: Starter (₹4,999/mo), Pro (₹14,999/mo), Enterprise (custom). Limits apply to
properties, employees, storage, and future AI minutes. Organization Owners can subscribe,
change plans, cancel at period end, view invoices, and monitor usage. Super Admins get
platform billing metrics (MRR, ARR, churn, plan distribution, subscription health).

---

### 4.10 Audit Logs

Immutable log: actor, tenant, entity, action, before/after JSON, IP, user agent, timestamp.

---

## 5. Access Matrix (Summary)

Full matrices in [RBAC.md](./RBAC.md).

| User | Modules | Listing visibility | CRUD |
|------|---------|-------------------|------|
| Super Admin | All (platform) | Cross-tenant analytics | Full org CRUD |
| Org Admin | All tenant modules | Full org data | Full except org delete |
| Sales Manager | CRM, Property, Team reports | Team + unassigned pool | Assign, no billing |
| Sales Executive | CRM, Property (assigned), AI, Chat | Assigned only | Edit assigned, no delete property |
| Telecaller | CRM, AI, limited Property | Call queue | Create/update inquiries |
| Marketing | Property, SEO | All properties | Property CRUD, no CRM assign |
| Client | Public browse, Inquiry, Chat, Profile | Public fields only | Submit inquiry, chat |

**Data filter:** `tenant_id = current_org` always.  
**Field-level:** Internal cost, owner phone hidden from Client role.

---

## 6. Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| Availability | 99.9% MVP, 99.95% enterprise |
| API latency p95 | < 300ms (excl. AI/search) |
| Search latency | < 500ms |
| Concurrent tenants | 10k+ |
| Data residency | India region (AWS ap-south-1) |
| Languages | English MVP; i18n-ready |
| Mobile | Responsive web MVP; native later |
| Accessibility | WCAG 2.1 AA target |

---

## 7. Out of Scope (MVP)

- Native iOS/Android apps  
- Full white-label custom domains (Phase 9)  
- Multi-currency  
- Legal document e-sign  
- MLS federation  
- Automated legal compliance for all states  

---

## 8. USP / Differentiators (Post-MVP)

| Feature | Value |
|---------|-------|
| AI property matching | Faster qualification |
| Auto PDF brochure | Marketing speed |
| Site visit scheduler | Ops efficiency |
| Voice notes on inquiries | Field sales |

Prioritize only when conversion data supports build.

---

## 9. Acceptance Criteria (MVP Release)

- [ ] Org can onboard, add 10 employees, import 100 properties  
- [ ] Client can browse public listing and submit inquiry  
- [ ] Executive can move inquiry through full pipeline  
- [ ] Manager sees dashboard KPIs accurate to DB  
- [ ] No cross-tenant data in penetration test sample  
- [ ] Core flows covered by E2E tests  

---

## 10. Phase 9 — Enterprise & White Label Platform (as-built)

Targets large agencies, builders, franchise networks and white-label resellers.

**Capabilities**

| Module | What tenants can do |
|--------|---------------------|
| Website Settings | Manage hero content, contact info, social links, testimonials, featured sections, footer. |
| Branding Settings | Logo, favicon, primary/secondary colors, typography, email & PDF branding. |
| SEO Settings | Meta title/description, Open Graph, Twitter cards, default schema, robots rules, sitemap options. |
| Custom Domains | Add subdomain (`demo.reos.app`) or vanity domain (`abc-realty.com`); DNS TXT verification + CNAME routing; SSL/verification status. |
| Feature Flags | Per-tenant toggles (chat, ai, billing, crm, website, analytics, notifications) stored in DB — no hard-coded flags. |
| Tenant Configuration | Central resolver for timezone, currency, language, date/number format, business hours (Indian defaults). |
| White Label | Hide RE-OS branding, custom logo/favicon/colors, custom email sender, custom login page. |
| Advanced Audit Logs | Who/what/when, before/after, IP, user agent; filter by actor/entity/date; CSV export. |
| Public Analytics | Property views/clicks, inquiry & chat conversions, top pages, traffic sources, referrers (privacy-preserving, IP hashed). |

**RBAC:** Owner = full settings; Admin = limited (no feature flags / white-label); Manager = read-only; Sales = no access. See [RBAC.md](./RBAC.md).

**Performance:** tenant settings + public analytics aggregations cached behind a Redis-shaped TTL interface with write invalidation.

**Out of scope (this phase):** AI Agent, Mobile Apps.

---

## Phase 10 — AI Agent Platform

**Goal:** an AI sales assistant that auto-qualifies leads, captures requirements,
reduces agent workload, and improves response speed — **enhancing the CRM, not
replacing it.**

| Module | Capability |
|--------|------------|
| AI Voice Agent | Inbound/outbound calls, recording (with consent), transcript, AI summary, requirement extraction, sentiment, next action |
| AI Chat Assistant | Website + CRM chat (WhatsApp-ready), property FAQs/availability/pricing, lead capture, RAG answers, human handoff |
| Lead Qualification | Extract budget, city, area, property type, requirement type, timeline, financing need → score → Hot / Warm / Cold |
| Property Matching | Match inquiries to properties by budget/location/type/bedrooms → ranked matches + match score + reasoning |
| Follow-up Automation | Call/visit reminders, re-engagement, missed-inquiry follow-ups |
| Conversation Intelligence | Summary, objections, buying signals, risk indicators, recommended actions |
| Vector Knowledge | Properties, FAQs, policies, docs → RAG + semantic search + context retrieval |

**No vendor lock-in:** all providers abstracted (`LLMProvider`, `VoiceProvider`,
`TranscriptionProvider`, `EmbeddingProvider`). Ships with Mock (offline) + OpenAI;
designed for Claude, Gemini, DeepSeek.

**RBAC:** Owner full · Admin manage · Manager view · Sales own conversations.
**Analytics:** AI conversations, conversions, qualification rates, match quality,
call outcomes, cost per lead. **Admin UI:** AI dashboard, assistant playground,
call logs + transcripts, knowledge base, prompt templates, follow-ups, settings.

Architecture: [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

---

*Detailed API and schema: [API_SPEC.md](./API_SPEC.md), [DB_SCHEMA.md](./DB_SCHEMA.md).*
