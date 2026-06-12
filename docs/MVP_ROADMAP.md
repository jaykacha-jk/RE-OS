# RE-OS Phase-Wise Implementation Roadmap

**Version:** 1.0  
**Last Updated:** 2026-06-05

Each phase includes: Objective, Features, Database Changes, APIs, UI Screens, Dependencies, Risks, Acceptance Criteria, Definition of Done.

---

## Phase 1 — Foundation

**Duration:** 4–6 weeks  
**Objective:** Secure multi-tenant identity, RBAC, organization and employee management.

### Features

- Email/password auth with JWT + refresh rotation  
- Super Admin platform console (org CRUD)  
- Organization provisioning (slug, tier, trial)  
- Employee CRUD + invitations  
- RBAC seed (roles, permissions, guards)  
- Tenant middleware + base repository scoping  
- Basic audit log (auth + CRUD)  
- Health check endpoint  

### Database Changes

- `organizations`, `organization_usage`  
- `users`, `refresh_tokens`, `password_reset_tokens`, `user_invitations`  
- `roles`, `permissions`, `role_permissions`, `user_roles`  
- `employees`  
- `audit_logs` (subset)  
- `subscription_plans` (seed data only)

### APIs

- `/auth/*`  
- `/platform/organizations/*`  
- `/employees/*`  
- `/auth/me` (permissions payload)

### UI Screens

| Screen | Roles |
|--------|-------|
| Login / Forgot password | All |
| Super Admin: Org list / create / edit | Super Admin |
| Tenant: Employee list / create / edit | Org Admin+ |
| Profile settings | All internal |
| Empty tenant dashboard shell | Org Admin |

### Dependencies

- AWS dev environment (or Docker Compose)  
- DNS wildcard `*.reos.app` (staging)

### Risks

| Risk | Mitigation |
|------|------------|
| RBAC complexity | Start with role templates; defer custom permissions |
| Tenant leak | Mandatory isolation test suite |

### Acceptance Criteria

- [ ] Super Admin creates org; owner receives invite and logs in  
- [ ] Org Admin adds 5 employees with distinct roles  
- [ ] Sales Executive cannot access employee admin API (403/404)  
- [ ] Cross-tenant API test passes 100%  
- [ ] Refresh token rotation works  

### Definition of Done

- Documentation synced (RBAC, API, DB)  
- 80%+ coverage on auth + tenant guards  
- Deployed to staging  
- Security review checklist complete  

---

## Phase 2 — Property Management

**Duration:** 4–5 weeks  
**Objective:** Full property inventory with media, search, and agent assignment.

### Features

- Property CRUD (all fields per PRD)  
- Slug generation + uniqueness  
- S3 presigned uploads + image ordering  
- Property assignment to employees  
- Elasticsearch indexing + search API  
- Public property browse (read-only)  
- Bulk CSV import (async job)  
- Publish/unpublish workflow  

### Database Changes

- `properties`, `property_media`, `property_assignments`, `property_history`

### APIs

- `/properties/*`  
- `/properties/search`  
- `/properties/:id/media/presign`  
- `/public/{slug}/properties/*`

### UI Screens

- Property list (filters, columns per role)  
- Property create/edit wizard  
- Media gallery manager  
- Public property listing + detail (SSR)  
- Map view (optional stretch)

### Dependencies

- Phase 1 complete  
- S3 bucket + CloudFront  
- Elasticsearch cluster

### Risks

| Risk | Mitigation |
|------|------------|
| ES sync lag | Queue + monitoring; fallback DB search |
| Large images | WebP conversion worker |

### Acceptance Criteria

- [ ] 100 properties imported via CSV  
- [ ] Public page renders SSR with meta tags  
- [ ] Search returns results <500ms p95  
- [ ] Assigned agent sees only assigned in executive role  

### Definition of Done

- SEO meta on public detail page  
- Index jobs monitored  
- E2E: create property → visible on public site  

---

## Phase 3 — CRM (Inquiry Pipeline)

**Duration:** 5–6 weeks  
**Objective:** End-to-end lead management from capture to closure.

### Features

- Inquiry CRUD + public submission  
- Configurable pipeline stages (seed defaults)  
- Kanban board  
- Activities timeline  
- Follow-up scheduler + overdue logic  
- Assignment + round-robin option  
- Duplicate phone warning  
- Link inquiries to properties  

### Database Changes

- `pipeline_stages`, `inquiries`, `inquiry_properties`, `inquiry_activities`, `follow_ups`

### APIs

- `/inquiries/*`, `/inquiries/kanban`  
- `/follow-ups/*`  
- `/public/{slug}/inquiries` (POST)

### UI Screens

- Inquiry list + filters  
- Inquiry detail drawer/page  
- Kanban pipeline  
- Follow-up calendar/list  
- Client: submit inquiry form  

### Dependencies

- Phase 1–2  
- Notification stubs (in-app only OK)

### Risks

| Risk | Mitigation |
|------|------------|
| Pipeline customization scope | Tenant-level stage names only MVP |
| Kanban performance | Pagination per column |

### Acceptance Criteria

- [ ] Public inquiry creates lead assigned per rules  
- [ ] Executive moves lead New → Closed Won  
- [ ] Activities and follow-ups visible on timeline  
- [ ] Duplicate phone warning shown  

### Definition of Done

- BUSINESS_RULES BR-C* tested  
- Manager sees team pipeline  

---

## Phase 4 — Dashboard & Reports

**Duration:** 3–4 weeks  
**Objective:** Operational visibility and exportable reports.

### Features

- Role-based dashboard KPIs  
- Charts: pipeline funnel, leads by source, agent performance  
- Daily snapshot job  
- CSV export (inquiries, properties)  
- Date range filters  

### Database Changes

- `analytics_events`, `analytics_daily_snapshots`

### APIs

- `/dashboard/summary`  
- `/reports/*`

### UI Screens

- Dashboard home (widgets per role)  
- Reports page + export buttons  

### Dependencies

- Phase 3 data volume  

### Risks

| Risk | Mitigation |
|------|------------|
| Slow aggregates | Materialized snapshots; cache 5m |

### Acceptance Criteria

- [ ] KPI numbers match DB spot checks  
- [ ] Export 10k inquiries completes <2 min async  

### Definition of Done

- Snapshot cron monitored  
- Manager dashboard validated with test data  

---

## Phase 5 — Notifications

**Duration:** 2–3 weeks  
**Objective:** Timely alerts across email, in-app, and WhatsApp.

### Features

- Notification templates (platform defaults + tenant override)  
- In-app notification center  
- Email via SES  
- Socket.io push for real-time  
- Follow-up reminders (scheduled jobs)  
- WhatsApp BSP integration (optional flag)  
- User preferences (non-transactional)  

### Database Changes

- `notification_templates`, `notifications`, `notification_deliveries`

### APIs

- `/notifications/*`  
- `/notification-preferences`

### UI Screens

- Notification bell + list  
- Preferences settings  

### Dependencies

- Phase 3 follow-ups  
- SES verified domain  

### Risks

| Risk | Mitigation |
|------|------------|
| WhatsApp template approval delay | Ship email + in-app first |

### Acceptance Criteria

- [ ] New inquiry triggers in-app + email to assignee  
- [ ] Follow-up reminder fires at due time  

### Definition of Done

- DLQ alerting configured  
- Unsubscribe works for marketing emails  

---

## Phase 6 — Chat System

**Duration:** 4–5 weeks  
**Objective:** Real-time engagement on website (WhatsApp later).

### Features

- Website chat widget (embed script)  
- Agent inbox  
- Conversation assignment  
- Message history  
- Socket.io realtime  
- Link chat → inquiry  

### Database Changes

- `chat_conversations`, `chat_messages`

### APIs

- `/chat/*` + WebSocket namespace  

### UI Screens

- Agent chat inbox  
- Conversation thread  
- Embeddable widget (public site)  

### Dependencies

- Phase 2 public site  
- Phase 5 notifications  

### Risks

| Risk | Mitigation |
|------|------------|
| WebSocket scale | Redis adapter early |

### Acceptance Criteria

- [ ] Client sends message; agent receives <2s  
- [ ] Conversation creates/links inquiry  

### Definition of Done

- Load test 500 concurrent connections staging  

---

## Phase 7 — Billing

**Duration:** 3–4 weeks  
**Objective:** Monetization via Razorpay subscriptions.

### Features

- Plan catalog (Basic/Pro/Enterprise)  
- Checkout + subscription lifecycle  
- Webhook processing (idempotent)  
- Invoice PDF generation  
- Usage limit enforcement  
- Billing portal (upgrade/downgrade)  

### Database Changes

- `subscriptions`, `invoices`, `payment_transactions` (expand)

### APIs

- `/billing/*`  
- `/billing/webhooks/razorpay`

### UI Screens

- Plans & pricing page  
- Subscription management  
- Invoice list  

### Dependencies

- Phase 1 org  
- Razorpay account  

### Risks

| Risk | Mitigation |
|------|------------|
| Webhook replay | Idempotency keys |

### Acceptance Criteria

- [ ] Test mode subscription activates tenant  
- [ ] Past due suspends org per BR-B02  

### Definition of Done

- BILLING_SPEC fully implemented  
- Finance sign-off on invoice format  

---

## Phase 8 — AI Agent

**Duration:** 4–6 weeks  
**Objective:** AI-assisted calling, transcription, and lead scoring.

### Features

- Outbound call initiation (telephony provider)  
- Recording storage  
- Whisper transcription job  
- GPT summary + structured extraction  
- Lead score 0–100  
- Auto-fill inquiry fields  
- Call history UI  

### Database Changes

- `ai_calls`, `ai_call_transcripts`

### APIs

- `/ai/calls/*`

### UI Screens

- AI calls list  
- Call detail + transcript player  
- Add number / trigger call  

### Dependencies

- Phase 3 inquiries  
- OpenAI + telephony provider  
- Compliance scripts  

### Risks

| Risk | Mitigation |
|------|------------|
| TRAI/DND compliance | BR-AI05 checks |
| Cost overrun | Per-tenant minute caps |

### Acceptance Criteria

- [ ] Call completes → transcript <5 min  
- [ ] Inquiry updated when confidence high  

### Definition of Done

- AI_AGENT_SPEC signed off  
- Legal review recording consent  

---

## Phase 9 — Enterprise Features

**Duration:** 4+ weeks (ongoing)  
**Objective:** Enterprise readiness — audit, flags, white-label.

### Features

- Full audit log UI + export  
- Feature flags per tenant  
- White-label branding (logo, colors)  
- Custom domains (SSL)  
- MFA for admins  
- Data export / GDPR delete job  
- Advanced RBAC permission overrides  

### Database Changes

- `feature_flags`, `tenant_feature_flags`, `seo_pages`  
- Custom domain mapping table  

### APIs

- `/audit-logs`, `/feature-flags`, `/tenant/settings`

### UI Screens

- Audit explorer  
- Branding settings  
- Domain DNS instructions  

### Dependencies

- All prior phases  

### Risks

| Risk | Mitigation |
|------|------------|
| Custom domain SSL complexity | Automated ACM + clear docs |

### Acceptance Criteria

- [ ] Enterprise tenant on custom domain with branding  
- [ ] MFA enforced for org_owner  

### Definition of Done

- SOC2 prep checklist started  
- Pen test remediation complete  

---

## MVP Release Bundle (Phases 1–4 + partial 5)

**Target:** First paying customers  
**Includes:** Auth, Org, Employees, Properties, CRM, Dashboard, Email notifications  
**Excludes:** AI, Chat, WhatsApp, White-label  

---

## Cross-Phase Engineering Standards

- Update docs in same PR as code  
- Migration review required  
- Feature flags for risky launches  
- Changelog entry per phase completion  

---

*Program plan: [PLAN.md](./PLAN.md). Product detail: [PRD.md](./PRD.md).*
