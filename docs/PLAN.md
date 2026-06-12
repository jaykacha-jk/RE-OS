# RE-OS Master Implementation Plan

**Product:** Real Estate Operating System (RE-OS)  
**Type:** Multi-Tenant B2B SaaS  
**Version:** 1.0  
**Status:** Pre-Implementation — Documentation Phase  
**Last Updated:** 2026-06-05

---

## 1. Executive Summary

RE-OS is a venture-scale multi-tenant SaaS platform for real estate agencies, builders, brokers, channel partners, and sales teams. The platform unifies property inventory, lead CRM, employee operations, AI-assisted qualification, live chat, billing, and analytics under strict tenant isolation and enterprise RBAC.

**North-star metric:** Deal closure rate per organization per month.

**Scale targets (36 months):**

| Dimension | Target |
|-----------|--------|
| Organizations | 10,000+ |
| Employees | 100,000+ |
| Properties | 5M+ |
| Inquiries | 10M+ |
| Chat messages | 50M+ |
| AI call sessions | 2M+ |

---

## 2. Vision & Business Model

### 2.1 Vision

Become the operating system for Indian real estate sales teams — replacing spreadsheets, WhatsApp chaos, and fragmented CRMs with one pipeline-aware platform.

### 2.2 Primary Business Flow

```
Lead → Qualification → Property Match → Site Visit → Negotiation → Deal Closure → Revenue
```

### 2.3 Target Customers

| Segment | Pain | RE-OS Value |
|---------|------|-------------|
| Real estate agencies | Lead leakage, no follow-up discipline | CRM + automation |
| Builders | Inventory + channel partner chaos | Property + assignment |
| Brokers | Multi-listing management | Search + SEO pages |
| Channel partners | Attribution unclear | Pipeline + reports |
| Sales teams | Manual calling, no transcripts | AI calling agent |

### 2.4 Business Decision Framework

Before any feature enters a phase, it must pass at least one:

1. Increases revenue (direct or expansion)
2. Improves lead conversion
3. Reduces manual operational work
4. Improves team productivity
5. Improves customer retention
6. Improves organic SEO visibility

If none apply → defer post-MVP.

---

## 3. Technical Strategy

### 3.1 Architecture Stance

| Principle | Decision |
|-----------|----------|
| Initial shape | Modular monolith (NestJS) |
| Future | Extract hot paths to microservices |
| Domain modeling | DDD bounded contexts |
| Data access | Repository pattern |
| Async work | BullMQ + domain events |
| Read scaling | Redis cache + Elasticsearch |
| IDs | UUID v7 (time-sortable) everywhere externally |

### 3.2 Tech Stack (Locked)

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query, RHF, Zod |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL 16+ |
| Cache | Redis 7+ |
| Queue | BullMQ |
| Storage | AWS S3 |
| Search | Elasticsearch 8+ |
| Realtime | Socket.io |
| AI | OpenAI API, Whisper |
| Payments | Razorpay |
| Deploy | Docker, AWS ECS |
| Observability | Prometheus, Grafana, Loki |

### 3.3 Multi-Tenancy Contract

Every business table includes:

- `id` (UUID, PK)
- `tenant_id` (UUID, FK → organizations.id, NOT NULL, indexed)
- `created_by`, `updated_by` (UUID, FK → users.id, nullable on system rows)
- `created_at`, `updated_at` (timestamptz)
- `deleted_at` (timestamptz, soft delete)

**Isolation rule:** All queries MUST filter `tenant_id = :currentTenantId` AND `deleted_at IS NULL` unless Super Admin cross-tenant tooling with explicit audit.

### 3.4 Documentation System

| Document | Purpose |
|----------|---------|
| [PRD.md](./PRD.md) | Product requirements |
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | Architecture |
| [DB_SCHEMA.md](./DB_SCHEMA.md) | Database |
| [API_SPEC.md](./API_SPEC.md) | REST API |
| [RBAC.md](./RBAC.md) | Access control |
| [BUSINESS_RULES.md](./BUSINESS_RULES.md) | Domain rules |
| [SECURITY.md](./SECURITY.md) | Security controls |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Infra & CI/CD |
| [MVP_ROADMAP.md](./MVP_ROADMAP.md) | Phased delivery |
| [BILLING_SPEC.md](./BILLING_SPEC.md) | Subscriptions |
| [AI_AGENT_SPEC.md](./AI_AGENT_SPEC.md) | AI calling |
| [SEO_STRATEGY.md](./SEO_STRATEGY.md) | Organic growth |
| [GROWTH_STRATEGY.md](./GROWTH_STRATEGY.md) | GTM |
| [REVENUE_MODEL.md](./REVENUE_MODEL.md) | Pricing |
| [KPI_FRAMEWORK.md](./KPI_FRAMEWORK.md) | Metrics |
| [COMPETITOR_ANALYSIS.md](./COMPETITOR_ANALYSIS.md) | Market |
| [UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md) | Design system |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Dev conventions |

---

## 4. Module Portfolio & CEO ROI Lens

| Module | Business Value | Revenue | Retention | Conversion | Ops |
|--------|----------------|---------|-----------|------------|-----|
| Auth + Org | Platform foundation | Indirect | High | — | High |
| Employees | Team scaling | Seat expansion | High | — | High |
| Property | Inventory truth | SEO traffic | Medium | High | High |
| Inquiry CRM | Pipeline discipline | Direct | High | **Critical** | High |
| AI Agent | Qualification speed | Upsell tier | Medium | **Critical** | High |
| Live Chat | Instant engagement | — | High | High | Medium |
| Dashboard | Manager visibility | — | Medium | Medium | High |
| Reports | Accountability | Enterprise tier | Medium | Medium | Medium |
| Notifications | Follow-up execution | — | High | High | Medium |
| Billing | Monetization | **Critical** | High | — | Medium |
| Audit | Enterprise trust | Enterprise tier | Medium | — | High |
| Analytics | Product decisions | — | Medium | Medium | Low |

**MVP cut line:** Phases 1–4 + partial Phase 5 (email/in-app only). Phases 6–9 post-MVP unless enterprise deal requires.

---

## 5. Phase-Wise Execution Summary

Full detail in [MVP_ROADMAP.md](./MVP_ROADMAP.md).

| Phase | Name | Duration (est.) | Outcome |
|-------|------|-----------------|---------|
| 1 | Foundation | 4–6 weeks | Auth, RBAC, Org, Employee |
| 2 | Property | 4–5 weeks | CRUD, media, search, assignment |
| 3 | CRM | 5–6 weeks | Inquiry, pipeline, follow-ups |
| 4 | Dashboard & Reports | 3–4 weeks | KPIs, exports |
| 5 | Notifications | 2–3 weeks | Email, in-app, WhatsApp |
| 6 | Chat | 4–5 weeks | Website chat, realtime |
| 7 | Billing | 3–4 weeks | Razorpay, plans, invoices |
| 8 | AI Agent | 4–6 weeks | Calling, transcript, scoring |
| 9 | Enterprise | 4+ weeks | Audit, flags, white-label |

---

## 6. Team Operating Model

### 6.1 Pre-Code Checklist

- [ ] PRD signed off for current phase
- [ ] DB migration reviewed
- [ ] API spec updated
- [ ] RBAC matrix updated
- [ ] Security review for new endpoints
- [ ] Cursor rules/skills synced

### 6.2 Definition of Ready (Story)

- Acceptance criteria written
- API contract in API_SPEC.md
- RBAC permissions identified
- Tenant scoping verified in design
- Test strategy defined

### 6.3 Definition of Done (Phase)

- All acceptance criteria met
- 80%+ coverage on critical paths
- Documentation updated
- Staging deployed and smoke-tested
- No P0/P1 security findings open

---

## 7. Risk Register (Program Level)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tenant data leak | Critical | Row-level tenant_id + integration tests |
| SEO thin content | Medium | Quality gates on programmatic pages |
| AI call compliance | High | Consent, recording disclosure, DND checks |
| Razorpay webhook failures | High | Idempotent handlers + dead-letter queue |
| Elasticsearch cost | Medium | Index lifecycle + tenant quotas |
| Scope creep | High | CEO decision framework per feature |

---

## 8. Repository Layout

```
realEstate/
├── docs/                 # Source of truth (this folder)
├── .cursor/
│   ├── rules/            # AI coding constraints
│   └── skills/           # Domain knowledge for agents
├── backend/              # NestJS modular monolith
└── frontend/             # Next.js application
```

---

## 9. Implementation Order (Strict)

1. Complete all documentation (current phase)
2. Bootstrap monorepo tooling (lint, CI skeleton)
3. Phase 1 implementation
4. Phase 2 … sequential unless parallel team capacity

**Do not write application business logic until Phase 1 docs are frozen and reviewed.**

---

## 10. Synchronization Rules

When changing any of the following, update dependent docs in the same PR:

| Change | Update |
|--------|--------|
| New table | DB_SCHEMA.md, API_SPEC.md, RBAC.md |
| New endpoint | API_SPEC.md, RBAC.md |
| New role/permission | RBAC.md, BUSINESS_RULES.md |
| New env var | DEPLOYMENT.md, SECURITY.md |
| New billing rule | BILLING_SPEC.md, BUSINESS_RULES.md |

---

*This plan is the single program-level guide. Module-level behavior lives in PRD, BUSINESS_RULES, and Cursor skills.*
