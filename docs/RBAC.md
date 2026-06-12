# RE-OS Role-Based Access Control (RBAC)

**Version:** 1.0  
**Last Updated:** 2026-06-05

---

## 1. Design Principles

1. **Deny by default** — no permission = no access  
2. **Tenant boundary** — permissions never bypass `tenant_id`  
3. **Layered enforcement** — API guard + service scope + UI visibility  
4. **Least privilege** — roles receive minimum permissions for job function  
5. **Field-level** — sensitive fields stripped in DTOs per role  

---

## 2. Role Definitions

| Code | Name | Scope | Description |
|------|------|-------|-------------|
| `super_admin` | Super Admin | Platform | Full platform access |
| `org_owner` | Organization Owner | Tenant | Billing, all modules, delete org request |
| `org_admin` | Organization Admin | Tenant | Ops, employees, properties, CRM |
| `sales_manager` | Sales Manager | Tenant | Team pipeline, assign leads, reports |
| `sales_executive` | Sales Executive | Tenant | Assigned leads & properties |
| `telecaller` | Telecaller | Tenant | Outbound calls, inquiry create/update |
| `client` | Client | Tenant + public | Browse, inquire, chat, profile |

---

## 3. Permission Naming Convention

`{module}.{resource}.{action}`

Examples: `property.listing.create`, `inquiry.pipeline.update`, `billing.subscription.read`

**Actions:** `create`, `read`, `update`, `delete`, `assign`, `export`, `impersonate`

---

## 4. Role Matrix (Module Access)

| Module | Super Admin | Org Owner | Org Admin | Sales Mgr | Sales Exec | Telecaller | Marketing | Client |
|--------|:-----------:|:---------:|:---------:|:---------:|:----------:|:----------:|:---------:|:------:|
| Platform Orgs | CRUD | — | — | — | — | — | — | — |
| Billing | CRUD | CRUD | Read | — | — | — | — | — |
| Employees | CRUD | CRUD | CRUD | Read | — | — | — | — |
| Properties | CRUD | CRUD | CRUD | RU | RU* | R | CRUD | R pub |
| Inquiries | CRUD | CRUD | CRUD | CRUD | RU* | CU | — | C own |
| AI Calls | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | — | — |
| Chat | CRUD | CRUD | CRUD | CRUD | RU* | RU | — | CU |
| Dashboard | CRUD | Read | Read | Read | Read* | Read* | Read | Read* |
| Reports | CRUD | Read | Read | Read | — | — | Read | — |
| Notifications | CRUD | Read | Read | Read | Read | Read | Read | Read |
| Audit Logs | Read | Read | Read | — | — | — | — | — |
| Settings | CRUD | CRUD | CRUD | — | — | — | — | Profile |

`*` = scoped to assigned records where noted.

---

## 5. Permission Matrix (Granular)

| Permission | super_admin | org_owner | org_admin | sales_manager | sales_executive | telecaller | client |
|------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| platform.organizations.create | ✓ | | | | | | |
| platform.organizations.read | ✓ | | | | | | |
| billing.plans.read | ✓ | ✓ | ✓ | | | | |
| billing.subscription.read | ✓ | ✓ | ✓ | | | | |
| billing.subscription.update | ✓ | ✓ | | | | | |
| billing.invoices.read | ✓ | ✓ | ✓ | | | | |
| billing.usage.read | ✓ | ✓ | ✓ | | | | |
| platform.billing.read | ✓ | | | | | | |
| employees.create | ✓ | ✓ | ✓ | | | | |
| employees.read | ✓ | ✓ | ✓ | ✓ | | | |
| employees.update | ✓ | ✓ | ✓ | | | | |
| employees.delete | ✓ | ✓ | ✓ | | | | |
| properties.create | ✓ | ✓ | ✓ | | | | |
| properties.read | ✓ | ✓ | ✓ | ✓ | ✓* | ✓ | ✓ |
| properties.update | ✓ | ✓ | ✓ | ✓ | ✓* | | |
| properties.delete | ✓ | ✓ | ✓ | | | | |
| properties.assign | ✓ | ✓ | ✓ | ✓ | | | |
| inquiries.create | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| inquiries.read | ✓ | ✓ | ✓ | ✓ | ✓* | ✓ | ✓* |
| inquiries.update | ✓ | ✓ | ✓ | ✓ | ✓* | ✓ | |
| inquiries.delete | ✓ | ✓ | ✓ | | | | |
| inquiries.assign | ✓ | ✓ | ✓ | ✓ | | | |
| ai.calls.create | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| ai.calls.read | ✓ | ✓ | ✓ | ✓ | ✓* | ✓* | |
| chat.read | ✓ | ✓ | ✓ | ✓ | ✓* | ✓* | ✓* |
| chat.respond | ✓ | ✓ | ✓ | ✓ | ✓* | ✓* | ✓ |
| dashboard.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| reports.read | ✓ | ✓ | ✓ | ✓ | | | |
| reports.export | ✓ | ✓ | ✓ | ✓ | | | |
| audit.read | ✓ | ✓ | ✓ | | | | |
| profile.update | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

> **As-built (Phase 3 CRM).** The implemented permission keys are namespaced under `crm.*`
> (the rows above are the conceptual model). Seeded keys and role grants:
>
> | Permission | super_admin | org_owner | org_admin | sales_manager | sales_executive | telecaller |
> |------------|:---:|:---:|:---:|:---:|:---:|:---:|
> | crm.inquiries.create | ✓ | ✓ | ✓ | ✓ | ✓ | |
> | crm.inquiries.read | ✓ | ✓ | ✓ | ✓ (team) | ✓ (assigned) | ✓ (assigned) |
> | crm.inquiries.update | ✓ | ✓ | ✓ | ✓ | ✓ | |
> | crm.inquiries.delete | ✓ | ✓ | ✓ | | | |
> | crm.inquiries.assign | ✓ | ✓ | ✓ | ✓ | | |
> | crm.notes.create | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
> | crm.followups.create / update | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
> | crm.sitevisits.create / update | ✓ | ✓ | ✓ | ✓ | ✓ | |
> | crm.lead_sources.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
> | crm.lead_sources.manage | ✓ | ✓ | ✓ | | | |
>
> Scope (full-access / team / assigned-only) is enforced in `CrmService.resolveScope()`
> exactly as the Phase 2 property scope. `client` has **no** CRM access. Telecaller is
> assigned-scope and (per the Phase 3 rule "telecaller can update notes and followups")
> can read assigned inquiries and create/update notes + follow-ups, but cannot create,
> update, assign, delete inquiries, or schedule site visits.

> **As-built (Phase 4 Analytics).** Two seeded permission keys, one shared scope model:
>
> | Permission | super_admin | org_owner | org_admin | sales_manager | sales_executive | telecaller | client |
> |------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
> | analytics.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
> | platform.analytics.read | ✓ | | | | | | |
>
> Data scope is enforced in `AnalyticsService.resolveScope()`: owner/admin →
> **org-wide** (`all`); sales_manager → **team** (self + direct reports); sales_executive /
> telecaller → **assigned-only** (their own records). `client` has **no** analytics access.
> The employee performance table is additionally gated to performance-view roles
> (owner / admin / manager); assigned-scope roles receive an empty employee list.
> `platform.analytics.read` powers the Super Admin cross-tenant dashboard and bypasses the
> tenant guard (Super Admin only).

> **As-built (Phase 5 Notifications).** Two seeded permission keys:
>
> | Permission | super_admin | org_owner | org_admin | sales_manager | sales_executive | telecaller |
> |------------|:---:|:---:|:---:|:---:|:---:|:---:|
> | notifications.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
> | notifications.templates.manage | ✓ | ✓ | ✓ | | | |
>
> `notifications.read` grants list/unread-count/mark-read and preference APIs for the
> authenticated user only (no cross-user access). `notifications.templates.manage` is for
> org admins and Super Admin. Notification controllers omit `TenantGuard` so Super Admin
> (`tenant_id` null) can access platform notifications; isolation is enforced in the
> repository by `user_id` + caller `tenant_id`.

> **As-built (Phase 6 Chat).** Seven seeded permission keys; scope in `ChatService.resolveScope()`:
>
> | Permission | super_admin | org_owner | org_admin | sales_manager | sales_executive | telecaller |
> |------------|:---:|:---:|:---:|:---:|:---:|:---:|
> | chat.conversations.create | ✓ | ✓ | ✓ | ✓ | | |
> | chat.conversations.read | ✓ | ✓ | ✓ | ✓ (team) | ✓ (assigned) | ✓ (assigned) |
> | chat.conversations.update | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
> | chat.conversations.assign | ✓ | ✓ | ✓ | ✓ | | |
> | chat.conversations.convert | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
> | chat.messages.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
> | chat.messages.send | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
>
> Full-access roles see all tenant conversations. `sales_manager` sees team-assigned +
> participant threads. `sales_executive` / `telecaller` see assigned + participant only.
> Assign requires `chat.conversations.assign` (manager+). Public client widget auth is deferred.

> **As-built (Phase 7 Billing).** Six tenant permission keys and one platform key:
>
> | Permission | super_admin | org_owner | org_admin |
> |------------|:---:|:---:|:---:|
> | billing.plans.read | ✓ | ✓ | ✓ |
> | billing.subscription.read | ✓ | ✓ | ✓ |
> | billing.subscription.update | ✓ | ✓ | |
> | billing.invoices.read | ✓ | ✓ | ✓ |
> | billing.usage.read | ✓ | ✓ | ✓ |
> | platform.billing.read | ✓ | | |
>
> Tenant billing endpoints use `TenantGuard`; webhooks use HMAC instead of JWT.
> `platform.billing.read` powers Super Admin MRR/ARR/churn metrics without tenant guard.

> **As-built (Phase 9 Enterprise & White Label).** Ten permission keys map the
> RBAC requirement (Owner = full settings; Admin = limited; Manager = read-only;
> Sales = none):
>
> | Permission | super_admin | org_owner | org_admin | sales_manager | others |
> |------------|:---:|:---:|:---:|:---:|:---:|
> | settings.read | ✓ | ✓ | ✓ | ✓ (read-only) | |
> | settings.branding.manage | ✓ | ✓ | ✓ | | |
> | settings.seo.manage | ✓ | ✓ | ✓ | | |
> | settings.website.manage | ✓ | ✓ | ✓ | | |
> | settings.configuration.manage | ✓ | ✓ | ✓ | | |
> | settings.domains.manage | ✓ | ✓ | ✓ | | |
> | settings.features.manage | ✓ | ✓ | | | |
> | settings.whitelabel.manage | ✓ | ✓ | | | |
> | audit.logs.export | ✓ | ✓ | ✓ | | |
> | analytics.public.read | ✓ | ✓ | ✓ | ✓ | |
>
> **Owner** gets every settings key (incl. features + white-label). **Admin** gets
> the limited bundle (branding/seo/website/configuration/domains, audit export,
> public analytics) but **not** features or white-label. **Manager** is read-only
> (`settings.read` + `analytics.public.read`). **Sales** has no settings access.
> Public settings (`GET /public/settings`) and analytics tracking
> (`POST /public/analytics/track`) require no auth (tenant resolved by slug; IPs hashed).

---

## 6. API Access Matrix (Sample Endpoints)

| Endpoint | Required Permission | Data Scope |
|----------|---------------------|------------|
| POST /platform/organizations | platform.organizations.create | Platform |
| GET /employees | employees.read | Tenant |
| POST /employees | employees.create | Tenant |
| GET /properties | properties.read | Tenant (+ scope filter) |
| POST /properties | properties.create | Tenant (quota BR-T04) |
| GET /properties/:id | properties.read | Scope (404 if out-of-scope) |
| PATCH /properties/:id | properties.update | Scope |
| DELETE /properties/:id | properties.delete | Tenant (soft delete) |
| POST /properties/:id/images | properties.update | Scope |
| POST /properties/:id/assign | properties.assign | Scope |
| GET /properties/:id/history | properties.read | Scope |
| GET /public/properties | none (rate limited) | Public (published+public) |
| GET /inquiries | inquiries.read | Assigned / team / all |
| PATCH /inquiries/:id | inquiries.update | Assigned or manager |
| POST /ai/calls | ai.calls.create | Tenant |
| GET /analytics/dashboard | analytics.read | Tenant (all / team / assigned) |
| GET /analytics/leads · /properties · /funnel · /sources · /conversions · /revenue | analytics.read | Tenant (all / team / assigned) |
| GET /analytics/employees | analytics.read | Tenant (manager+; assigned → empty) |
| GET /platform/analytics/dashboard | platform.analytics.read | Platform (Super Admin, cross-tenant) |
| GET /billing/subscription | billing.subscription.read | Own tenant |
| GET /billing/plans | billing.plans.read | Own tenant |
| POST /billing/subscribe · /change-plan · /cancel | billing.subscription.update | Own tenant |
| GET /billing/invoices | billing.invoices.read | Own tenant |
| GET /billing/usage | billing.usage.read | Own tenant |
| GET /platform/billing/metrics | platform.billing.read | Platform |
| GET /audit-logs | audit.logs.read | Own tenant |
| GET /audit-logs/export | audit.logs.export | Own tenant (CSV) |
| GET /settings · /settings/branding · /seo · /website · /features · /configuration · /white-label | settings.read | Own tenant |
| PATCH /settings/branding | settings.branding.manage | Own tenant |
| PATCH /settings/seo | settings.seo.manage | Own tenant |
| PATCH /settings/website | settings.website.manage | Own tenant |
| PATCH /settings/configuration | settings.configuration.manage | Own tenant |
| PATCH /settings/features | settings.features.manage | Own tenant (Owner) |
| PATCH /settings/white-label | settings.whitelabel.manage | Own tenant (Owner) |
| GET/POST/PATCH/DELETE /settings/domains | settings.domains.manage (read: settings.read) | Own tenant |
| GET /analytics/public | analytics.public.read | Own tenant |
| GET /public/settings · POST /public/analytics/track | none (tenant by slug) | Public |
| GET /notifications | notifications.read | Own user (+ tenant) |
| GET /notifications/unread-count | notifications.read | Own user |
| PATCH /notifications/:id/read | notifications.read | Own user |
| GET /notification-preferences | notifications.read | Own user |
| GET /notification-templates | notifications.templates.manage | Tenant (Super Admin: system) |

---

## 7. UI Visibility Matrix

| UI Element | Super Admin | Org Owner | Org Admin | Sales Mgr | Sales Exec | Telecaller | Marketing | Client |
|------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Org switcher / platform nav | ✓ | | | | | | | |
| Analytics nav (`/analytics`) | ✓ | ✓ | ✓ | ✓ | ✓* | ✓* | ✓ | |
| Performance nav (`/performance`) | ✓ | ✓ | ✓ | ✓ | | | ✓ | |
| Platform dashboard (cross-tenant KPIs) | ✓ | | | | | | | |
| Team performance table on dashboard | ✓ | ✓ | ✓ | ✓ | | | ✓ | |
| Billing & plans menu | ✓ | ✓ | ✓ | | | | | |
| Employee admin columns (revenue) | ✓ | ✓ | ✓ | partial | | | | |
| Property delete button | ✓ | ✓ | ✓ | | | | ✓ | |
| Inquiry kanban (all stages) | ✓ | ✓ | ✓ | ✓ | ✓* | ✓ | | |
| Assign lead dropdown | ✓ | ✓ | ✓ | ✓ | | | | |
| AI call initiate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Internal property ID column | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Cost / commission fields | ✓ | ✓ | ✓ | ✓ | | | | |
| Public chat widget | | | | | | | | ✓ |

---

## 8. Field-Level Permissions

| Entity | Field | Visible To |
|--------|-------|------------|
| Property | `internal_notes` | org_admin+ |
| Property | `owner_phone` | org_admin, assigned agent |
| Property | `commission_pct` | org_owner, org_admin |
| Inquiry | `lead_score` | internal roles |
| Inquiry | `source` detail | manager+ |
| Employee | `performance_metrics` | manager+ |
| Organization | `billing_email` | org_owner, super_admin |
| AI Call | `recording_url` | roles with ai.calls.read |

**Implementation:** Use NestJS serialization groups or explicit DTO mappers per role.

---

## 9. Data Scope Rules

| Role | Inquiry Query Filter | Property Query Filter |
|------|---------------------|----------------------|
| org_owner, org_admin | `tenant_id = :t` | `tenant_id = :t` (all) |
| sales_manager | team employees OR unassigned | **team** — assigned to self **or direct reports** |
| sales_executive | `assigned_employee_id = me` | **assigned only** (authenticated API) |
| telecaller | created by me OR assigned | **assigned only** (`properties.read` granted for calling context) |
| client | `client_user_id = me` | public only (via `/public/properties`) |

> **As-built (Phase 2).** `PropertiesService.resolveScope()` enforces this:
> full-access roles (`super_admin`, `org_owner`, `org_admin`) →
> `{ type: 'all' }`; `sales_manager` → self + `findSubordinateEmployeeIds`;
> everyone else → assigned-only. Out-of-scope reads return **404** (existence hidden).
> Public visibility is served by the separate unauthenticated `/api/v1/public/properties`
> endpoints (published + public + has-image only), not the authenticated client role.

---

## 10. Super Admin Impersonation

- Permission: `platform.impersonate`  
- Requires `X-Tenant-Id` header  
- JWT flagged `impersonated: true`  
- All actions logged to `audit_logs` with `actor_id` = super admin  

---

## 11. Implementation Checklist

- [ ] Seed system roles + permissions on deploy  
- [ ] `@RequirePermissions()` decorator on all controllers  
- [ ] `TenantGuard` validates JWT tenant matches resource  
- [ ] `ScopeService` applies assignment filters in repositories  
- [ ] Frontend menu generated from `/auth/me` permissions array  
- [x] Integration tests: cross-tenant access returns 404  

---

*Business rules: [BUSINESS_RULES.md](./BUSINESS_RULES.md). Security: [SECURITY.md](./SECURITY.md).*
