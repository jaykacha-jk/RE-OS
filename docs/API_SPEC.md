# RE-OS API Specification

**Base URL:** `https://api.reos.app/api/v1`  
**Tenant UI:** `https://{slug}.reos.app`  
**Auth:** Bearer JWT (`Authorization: Bearer <access_token>`)  
**Content-Type:** `application/json`  
**Version:** 1.0  
**Last Updated:** 2026-06-10 (Phase 9 — Enterprise & White Label)

---

## 1. Global Conventions

### 1.1 Standard Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes (except public) | JWT access token |
| `X-Request-Id` | Optional | Client correlation; echoed in response |
| `X-Tenant-Id` | Super Admin only | Target tenant for impersonation |
| `Accept-Language` | Optional | `en` default |

### 1.2 Standard Response Envelope

**Success (single resource):**
```json
{
  "data": { },
  "meta": { "request_id": "uuid" }
}
```

**Success (collection):**
```json
{
  "data": [ ],
  "meta": {
    "request_id": "uuid",
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

### 1.3 Standard Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable summary",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ],
    "request_id": "uuid"
  }
}
```

### 1.4 Error Codes

| HTTP | Code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | DTO validation failed |
| 401 | `UNAUTHORIZED` | Missing/invalid token |
| 403 | `FORBIDDEN` | RBAC or tenant mismatch |
| 404 | `NOT_FOUND` | Resource not found or cross-tenant |
| 409 | `CONFLICT` | Duplicate slug, phone |
| 422 | `BUSINESS_RULE_VIOLATION` | Domain rule failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### 1.5 Pagination Query Params

| Param | Default | Max |
|-------|---------|-----|
| `page` | 1 | — |
| `per_page` | 20 | 100 |
| `sort` | `-created_at` | field prefixed with `-` for DESC |
| `filter[field]` | — | module-specific |

---

## 2. Authentication

### POST `/auth/login`

**Description:** Email/password login for internal and client users.

**Authorization:** Public (rate limit: 10/min/IP)

**Request:**
```json
{
  "email": "admin@xyz.realty",
  "password": "SecurePass123!",
  "tenant_slug": "xyz"
}
```

**Validation:**
- `email`: required, email format
- `password`: required, min 8 chars
- `tenant_slug`: required for non-super-admin

**Response 200:**
```json
{
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 900,
    "user": {
      "id": "uuid",
      "email": "admin@xyz.realty",
      "first_name": "Admin",
      "roles": ["org_admin"],
      "tenant_id": "uuid"
    }
  }
}
```

**Error 401:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials",
    "request_id": "uuid"
  }
}
```

---

### POST `/auth/refresh`

**Authorization:** Public (refresh token in body)

**Request:**
```json
{ "refresh_token": "eyJ..." }
```

**Response 200:** Same shape as login (new token pair; old refresh revoked).

---

### POST `/auth/logout`

**Authorization:** Bearer JWT

**Request:**
```json
{ "refresh_token": "eyJ..." }
```

**Response 204:** No content.

---

### POST `/auth/forgot-password`

**Authorization:** Public

**Request:** `{ "email": "user@example.com", "tenant_slug": "xyz" }`

**Response 200:** Always success message (no email enumeration).

---

### POST `/auth/reset-password`

**Request:** `{ "token": "...", "password": "NewSecure123!" }`

**Validation:** password min 8, 1 upper, 1 lower, 1 digit

---

## 3. Platform (Super Admin)

### GET `/platform/organizations`

**Authorization:** `super_admin` + permission `platform.organizations.read`

**Query:** `filter[status]=active`, `filter[tier]=pro`, `page`, `per_page`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "ABC Realty",
      "slug": "abc",
      "domain": "abc.reos.app",
      "status": "active",
      "tier": "pro",
      "properties_count": 150,
      "employees_count": 12,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 5 }
}
```

---

### POST `/platform/organizations`

**Authorization:** `platform.organizations.create`

**Request:**
```json
{
  "name": "XYZ Realty",
  "slug": "xyz",
  "tier": "pro",
  "billing_email": "bill@xyz.realty",
  "owner_email": "admin@xyz.realty"
}
```

**Validation:**
- `slug`: `^[a-z0-9-]{3,63}$`, unique
- `tier`: enum basic|pro|enterprise

**Response 201:** Organization + invitation sent flag.

**Error 409:** Slug taken.

---

### PATCH `/platform/organizations/:id`

**Authorization:** `platform.organizations.update`

**Request:** Partial fields `status`, `tier`, `billing_email`

---

## 4. Employees

### GET `/employees`

**Authorization:** `employees.read`  
**Tenant:** JWT `tenant_id`

**Query filters:** `filter[role]=sales_executive`, `filter[status]=active`, `filter[search]=krunal`

**Response 200:** List with `properties_assigned_count`, `open_inquiries_count`.

---

### POST `/employees`

**Authorization:** `employees.create`

**Request:**
```json
{
  "first_name": "Krunal",
  "last_name": "Thakkar",
  "email": "k@abc.com",
  "phone": "+919876543210",
  "role_code": "sales_executive",
  "manager_id": "uuid-or-null"
}
```

**Validation:** phone E.164; unique email/phone per tenant

**Response 201:** Employee + user invitation.

---

### GET `/employees/:id`

**Authorization:** `employees.read` (+ assigned-only scope for sales_executive viewing peers: 403)

---

### PATCH `/employees/:id`

**Authorization:** `employees.update`

---

### DELETE `/employees/:id`

**Authorization:** `employees.delete`  
**Behavior:** Soft delete user + employee; reassign open inquiries required (422 if not).

---

## 5. Properties

> **As-built (Phase 2).** Base path `/api/v1/properties`. All routes require
> `Authorization: Bearer <jwt>`, are tenant-scoped, and enforce RBAC at the
> controller (`@RequirePermissions`) **and** service (data scope) layers.
> Responses use the `{ data, meta }` envelope.

### GET `/properties`

**Authorization:** `properties.read`  
**Scope:** Owner/Admin/Marketing → all tenant properties; Sales Manager → self + direct reports; Sales Executive → assigned only.

**Query params**

| Param | Notes |
|-------|-------|
| `search` | matches `title`, `property_code`, `city`, `address` |
| `filter[type]` | `residential` \| `commercial` |
| `filter[category]` | `flat` \| `villa` \| `plot` \| `office` \| `shop` \| `warehouse` |
| `filter[status]` | `draft` \| `pending_review` \| `published` \| `reserved` \| `sold` \| `archived` |
| `filter[requirement_type]` | `buy` \| `sell` \| `rent` |
| `filter[city]` | exact/contains city |
| `filter[assigned_user]` | employee id |
| `filter[min_price]` / `filter[max_price]` | numeric |
| `sort_by` | `created_at` \| `updated_at` \| `price` \| `title` \| `status` \| `city` |
| `sort_dir` | `asc` \| `desc` |
| `page` / `per_page` | pagination (default 1 / 20) |

**Response 200:** `{ data: Property[], meta: { page, per_page, total, total_pages } }`

---

### POST `/properties`

**Authorization:** `properties.create`  
**Rules:** Quota enforced (BR-T04 → `422 QUOTA_EXCEEDED`). `slug` + `property_code` auto-generated and unique per tenant.

**Request:**
```json
{
  "title": "3BHK Luxury Flat SG Highway",
  "type": "residential",
  "category": "flat",
  "requirement_type": "sell",
  "price": 8500000,
  "maintenance": 2500,
  "city": "Ahmedabad",
  "state": "Gujarat",
  "bedrooms": 3,
  "bathrooms": 2,
  "super_builtup_area": 1450,
  "amenities": ["gym", "parking"],
  "tags": ["premium"],
  "status": "draft",
  "is_public": false
}
```

**Response 201:** Property with auto-generated `slug` + `property_code`.

---

### GET `/properties/:id`

**Authorization:** `properties.read` (+ scope). Out-of-scope → `404` (existence hidden).

---

### PATCH `/properties/:id`

**Authorization:** `properties.update`  
**Behavior:** Status transitions validated (`422 INVALID_STATUS_TRANSITION`); price/status/assignment changes write `property_history`. Archiving/selling forces `is_public=false` (BR-P03/BR-P07).

---

### DELETE `/properties/:id`

**Authorization:** `properties.delete`  
**Behavior:** Soft delete (`deleted_at`). Returns `{ data: { id, deleted: true } }`.

---

### Media — images

| Method | Path | Perm | Notes |
|--------|------|------|-------|
| POST | `/properties/:id/images` | `properties.update` | body: `{ url }` **or** `{ filename, content_base64, content_type, alt_text, is_cover }` |
| DELETE | `/properties/:id/images/:imageId` | `properties.update` | removes DB row + storage object |
| PATCH | `/properties/:id/images/reorder` | `properties.update` | body: `{ image_ids: [...] }` (must be the full set) |
| PATCH | `/properties/:id/images/:imageId/cover` | `properties.update` | sets cover image |

**Videos:** `POST /properties/:id/videos`, `DELETE /properties/:id/videos/:videoId`.  
**Documents:** `POST /properties/:id/documents`, `DELETE /properties/:id/documents/:documentId`.

Storage uses an S3 abstraction with a local-disk fallback for development (served under `/static/...`).

---

### POST `/properties/:id/assign`

**Authorization:** `properties.assign`  
**Request:** `{ "employee_ids": ["uuid"], "primary_employee_id": "uuid" }`  
**Rules:** All `employee_ids` must belong to the tenant (`400` otherwise); `primary_employee_id` must be within `employee_ids`; ids deduped; default primary = first id (BR-P06). Writes `assignment_changed` history + audit log.

---

### GET `/properties/:id/history`

**Authorization:** `properties.read` (+ scope)  
**Response:** `{ data: [{ id, change_type, changed_fields, changed_by, changed_by_email, created_at }] }`

---

## 6. Public Website API

> **Phase 8 public website foundation.** No auth (rate limited). Tenant is resolved from
> subdomain/custom-domain routing when available, with the `tenant` query param retained
> as a local-development fallback. Only public-safe fields are returned — never
> `tenant_id`, internal notes, audit fields, or assignments. Only `is_public = true`,
> `status = published`, non-deleted listings with ≥1 image are included in listing feeds.

### GET `/public/properties?tenant={slug}`

**Query:** `tenant` (required), `search`, `filter[type]`, `filter[category]`, `filter[requirement_type]`, `filter[city]`, `filter[min_price]`, `filter[max_price]`, `page`, `per_page`.

**Response 200:** `{ data: PublicProperty[], meta: { page, per_page, total, total_pages, tenant, request_id } }`

---

### GET `/public/properties/{slug}?tenant={slug}`

**Response:** Public listing + SEO meta (`meta_title`, `meta_description`), images, amenities, tags. `404` if not found / not public.

---

### POST `/public/{tenant_slug}/inquiries`

**Description:** Public website lead capture. Creates a CRM inquiry through the CRM service so duplicate detection (BR-C01), audit logging, and `inquiry.created` domain events remain active.

**Request:**
```json
{
  "client_name": "Rahul Sharma",
  "phone": "+919876543210",
  "email": "rahul@example.com",
  "whatsapp": "+919876543210",
  "property_slug": "3bhk-flat-sg-highway",
  "requirement_type": "buy",
  "budget_min": 5000000,
  "budget_max": 8000000,
  "preferred_location": "SG Highway, Ahmedabad",
  "message": "Interested in a site visit this weekend"
}
```

**Validation:** `client_name`, `phone` required. `property_slug` is optional but, when provided, must resolve to a public listing within the same tenant. Unknown or cross-tenant slugs return `404`.

**Response 201:**
```json
{
  "data": {
    "inquiry_id": "uuid",
    "inquiry_code": "INQ-ABC123",
    "message": "We will contact you shortly"
  },
  "meta": { "request_id": "uuid" }
}
```

### Public website routes served by frontend

| Route | Purpose |
|-------|---------|
| `/` | Tenant-branded homepage / search entry |
| `/listings` | Compatibility listing grid |
| `/listings/{slug}` | Compatibility detail route, canonicalized to SEO URL |
| `/buy/{city}` | Buy city hub |
| `/rent/{city}` | Rent city hub |
| `/commercial/{city}` | Commercial city hub |
| `/buy/{city}/{slug}` | Canonical buy property detail |
| `/rent/{city}/{slug}` | Canonical rent property detail |
| `/commercial/{city}/{slug}` | Canonical commercial property detail |
| `/sitemap.xml` | Tenant-aware XML sitemap |
| `/robots.txt` | Public crawler policy |

---

## 7. CRM / Inquiries (Phase 3 — implemented)

All routes are tenant-scoped and RBAC-enforced at API **and** service layer.
**Scope:** full-access roles (super_admin, org_owner, org_admin) see all
inquiries; sales_manager sees self + direct reports; sales_executive and telecaller see
assigned only. Out-of-scope inquiries return **404** (existence hidden).

Pipeline stages (fixed): `NEW → CONTACTED → QUALIFIED → SITE_VISIT_SCHEDULED →
SITE_VISIT_COMPLETED → NEGOTIATION → BOOKED → CLOSED_WON | CLOSED_LOST`.
Non-privileged roles follow the forward transition map; privileged roles
(super_admin/org_owner/org_admin/sales_manager) may jump stages (recorded in history).

### GET `/inquiries`

**Authorization:** `crm.inquiries.read`  
**Query:** `search` (client_name/phone/email/inquiry_code), `filter[stage]`,
`filter[priority]`, `filter[temperature]`, `filter[source]`, `filter[assigned_employee]`,
`filter[property]`, `filter[date_from]`, `filter[date_to]`, `sort_by`
(`created_at|updated_at|stage|priority|lead_score|client_name`), `sort_dir`, `page`, `per_page`  
**Response 200:** `{ data: Inquiry[], meta: { page, per_page, total, total_pages } }`

---

### POST `/inquiries`

**Authorization:** `crm.inquiries.create`  
**Request:**
```json
{
  "client_name": "Rahul Sharma",
  "phone": "+919876543210",
  "email": "rahul@example.com",
  "whatsapp": "+919876543210",
  "property_id": "uuid",
  "assigned_employee_id": "uuid",
  "source_id": "uuid",
  "source_name": "Walk-in",
  "budget_min": 5000000,
  "budget_max": 8000000,
  "requirement_type": "buy",
  "preferred_location": "SG Highway",
  "property_type": "residential",
  "bedrooms": 3,
  "purchase_timeline": "1_3_months",
  "priority": "high",
  "temperature": "hot",
  "lead_score": 70,
  "remarks": "Urgent buyer",
  "override_duplicate": false
}
```
**Rules:** BR-C01 duplicate detection (same phone + open stage within 30 days → 409 unless
`override_duplicate`), BR-C08 budget (`budget_max >= budget_min` → 422). Auto-generates
`inquiry_code`; new inquiries start in `NEW`.  
**Response 201:** `{ data: Inquiry }`

---

### GET `/inquiries/:id`

**Authorization:** `crm.inquiries.read`  
**Response 200:** `{ data: Inquiry }` including `notes[]`, `followups[]`, `site_visits[]`.

---

### PATCH `/inquiries/:id`

**Authorization:** `crm.inquiries.update`  
Lead detail edits only (stage → `/stage`, assignment → `/assign`). Changed fields are
recorded in inquiry history.

---

### DELETE `/inquiries/:id`

**Authorization:** `crm.inquiries.delete`  
Soft delete. **Response 200:** `{ data: { id, deleted: true } }`

---

### POST `/inquiries/:id/assign`

**Authorization:** `crm.inquiries.assign`  
**Request:** `{ "employee_id": "uuid" }` — validates tenant membership; writes assignment
record + history + activity.

---

### PATCH `/inquiries/:id/stage`

**Authorization:** `crm.inquiries.update`  
**Request:** `{ "stage": "CLOSED_WON", "lost_reason"?: "...", "no_property_reason"?: "..." }`  
**Rules:** BR-C02 transition guard; BR-C03 (Closed Won requires linked property OR
`no_property_reason`); BR-C04 (Closed Lost requires `lost_reason`). Writes history + activity;
sets `closed_at` on terminal stages.

---

### POST `/inquiries/:id/notes` · GET `/inquiries/:id/notes`

**Authorization:** `crm.notes.create` (create) / `crm.inquiries.read` (list)  
**Request:** `{ "note": "Called client, will revert" }`

---

### POST `/inquiries/:id/followups` · GET `/inquiries/:id/followups` · PATCH `/inquiries/:id/followups/:followupId`

**Authorization:** `crm.followups.create` / `crm.inquiries.read` / `crm.followups.update`  
**Create:** `{ "followup_date": "2026-06-15", "followup_time": "15:30",
"followup_type": "call|meeting|whatsapp|site_visit|email",
"assigned_employee_id"?: "uuid", "notes"?: "..." }`  
**Update:** `{ "status": "pending|completed|missed|rescheduled", ... }` (completing sets
`completed_at`).

---

### POST `/inquiries/:id/site-visits` · GET `/inquiries/:id/site-visits` · PATCH `/inquiries/:id/site-visits/:visitId`

**Authorization:** `crm.sitevisits.create` / `crm.inquiries.read` / `crm.sitevisits.update`  
**Create:** `{ "scheduled_at": "2026-06-18T10:30:00.000Z", "property_id"?: "uuid",
"employee_id"?: "uuid", "notes"?: "..." }` (defaults to inquiry property/assignee).  
**Update:** `{ "status": "scheduled|completed|cancelled|no_show", ... }` (completing writes a
`site_visit_completed` activity).

---

### GET `/inquiries/:id/history`

**Authorization:** `crm.inquiries.read`  
**Response 200:** `{ data: { history: InquiryHistory[], activities: InquiryActivity[] } }` —
the merged timeline (created, updated, stage changes, assignments, notes, follow-ups, site
visits, closed won/lost).

---

### GET `/inquiries/metrics`

**Authorization:** `crm.inquiries.read`  
**Query:** `date_from`, `date_to` (optional, scoped to caller)  
**Response 200:** `{ data: { total_leads, qualified_leads, site_visits, won_deals,
lost_deals, conversion_rate, by_stage, top_performer } }` — dashboard-ready (Phase 4
consumer).

---

### GET `/lead-sources` · POST `/lead-sources` · PATCH `/lead-sources/:id`

**Authorization:** `crm.lead_sources.read` / `crm.lead_sources.manage`  
**List query:** `include_inactive=true` to include deactivated sources.  
**Create:** `{ "name": "Google Ads", "code"?: "google_ads", "is_active"?: true }` (unique
name per tenant → 409 on clash).  
**Update:** `{ "name"?, "code"?, "is_active"? }` (rename / activate / deactivate).

---

## 8. AI Agent

### POST `/ai/calls`

**Authorization:** `ai.calls.create`

**Request:**
```json
{
  "client_phone": "+9198xxxxxxxx",
  "inquiry_id": "uuid",
  "context_notes": "Urgent buyer"
}
```

**Response 202:** Call queued/initiated.

---

### GET `/ai/calls`

**Authorization:** `ai.calls.read`

---

### GET `/ai/calls/:id`

Includes transcript link when ready.

---

### GET `/ai/calls/:id/transcript`

**Authorization:** `ai.calls.read`

---

## 9. Chat (Phase 6 — implemented)

Base path: `/api/v1`. All endpoints require JWT + tenant context unless noted.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/conversations` | `chat.conversations.create` | Create conversation (optional initial message) |
| GET | `/conversations` | `chat.conversations.read` | List conversations (RBAC-scoped, paginated) |
| GET | `/conversations/unread-count` | `chat.conversations.read` | Unread conversation count for current user |
| GET | `/conversations/:id` | `chat.conversations.read` | Conversation detail + participants |
| PATCH | `/conversations/:id` | `chat.conversations.update` | Update metadata / status / tags |
| POST | `/conversations/:id/assign` | `chat.conversations.assign` | Assign to employee |
| POST | `/conversations/:id/close` | `chat.conversations.close` | Close or archive |
| POST | `/conversations/:id/convert-inquiry` | `chat.conversations.convert` | Link or create CRM inquiry |
| GET | `/conversations/:id/messages` | `chat.messages.read` | List messages (newest first) |
| POST | `/conversations/:id/messages` | `chat.messages.send` | Send text / attachments (base64) |
| GET | `/conversations/:id/activities` | `chat.conversations.read` | Activity + assignment history |
| PATCH | `/messages/:id/read` | `chat.messages.read` | Mark read for current participant |
| POST | `/public/chat/conversations` | Public | Start website chat, create conversation, return HMAC visitor token |
| GET | `/public/chat/conversations/:id/messages` | Public + chat token | List messages for the visitor conversation |
| POST | `/public/chat/conversations/:id/messages` | Public + chat token | Send visitor message |

**List filters:** `filter[status]`, `filter[type]`, `filter[assigned_employee]`, `filter[property]`, `filter[unread]`, `filter[mine]`, `search`, `sort_by`, `sort_dir`.

**Send message body:** `{ "content": "…", "message_type": "text", "attachments": [{ "name", "kind", "content_base64", "content_type" }] }`

**Public chat start body:** `{ "tenant": "demo", "client_identifier": "browser-session-id", "client_name": "Rahul", "client_phone": "+919876543210", "property_slug": "optional-listing-slug", "message": "I want to visit this property" }`

**Public chat auth:** `POST /public/chat/conversations` returns `{ conversation, token }`. Subsequent public message calls pass the token via `Authorization: Bearer <token>` (or `?token=` for message listing). Tokens are HMAC-bound to tenant + conversation + visitor id.

**Domain events (automation):** `chat.conversation.created`, `chat.conversation.assigned`, `chat.conversation.closed`, `chat.message.received`, `chat.message.read`

### WebSocket (Socket.io)

**Namespace:** `/chat` (e.g. `http://localhost:3001/chat`)  
**Auth:** JWT via `handshake.auth.token` or `?token=`  
**Client → server:** `conversation:subscribe`, `conversation:unsubscribe`, `chat:typing`  
**Server → client:** `chat:message_new`, `chat:message_read`, `chat:typing`, `chat:conversation_assigned`, `chat:conversation_closed`, `chat:conversation_updated`, `chat:unread_count`

---

## 10. Dashboard & Analytics (Phase 4 — implemented)

All analytics calculations live in `AnalyticsService` (controllers stay thin). Results are
served from a 60s in-memory cache keyed by tenant + RBAC scope + time range (Redis-ready).

**Time-range query (all endpoints):** `range=today|7d|30d|90d|custom` (default `30d`).
For `range=custom` pass `date_from` + `date_to` (ISO 8601).

**RBAC & scope (tenant endpoints, permission `analytics.read`):**

| Role | Scope of returned data |
|------|------------------------|
| `org_owner`, `org_admin` | Whole organization (`scope: "all"`) |
| `sales_manager` | Their team — self + direct reports (`scope: "team"`) |
| `sales_executive`, `telecaller` | Only records assigned to them (`scope: "assigned"`) |
| `client` | No access (403) |

The employee performance table is only included for roles that can view team performance
(owner / admin / marketing / manager); assigned-scope roles get an empty list.

---

### GET `/analytics/dashboard`

**Authorization:** `analytics.read`  
Single aggregation endpoint that powers the dashboard home in one round trip.

**Response 200:**
```json
{
  "data": {
    "scope": "all",
    "range": { "range": "30d", "from": "2026-05-10T...", "to": "2026-06-09T..." },
    "properties": { "total": 50, "active": 32, "published": 28, "reserved": 4, "sold": 10, "draft": 6, "by_status": { } },
    "leads": { "total": 120, "new": 30, "contacted": 20, "qualified": 45, "site_visits": 18, "won": 12, "lost": 8, "conversion_rate": 10.0, "by_stage": { } },
    "revenue": { "currency": "INR", "won_deals": 12, "won_amount": 45000000, "avg_deal_value": 3750000 },
    "funnel": [ { "key": "new", "label": "New", "count": 120 } ],
    "sources": [ { "source": "Website", "count": 40 } ],
    "monthly_leads": [ { "month": "2026-06", "leads": 30 } ],
    "monthly_conversion": [ { "month": "2026-06", "leads": 30, "won": 4, "conversion_rate": 13.33 } ],
    "employees": [ { "employee_id": "uuid", "name": "Asha", "leads": 30, "won": 5, "lost": 2, "site_visits": 8, "conversion_rate": 16.67 } ],
    "team_size": 6,
    "generated_at": "2026-06-09T..."
  }
}
```

---

### GET `/analytics/leads`

**Authorization:** `analytics.read`  
Lead KPIs (total, new, contacted, qualified, site_visits, won, lost, conversion_rate, by_stage) + `monthly_leads` trend.

### GET `/analytics/properties`

**Authorization:** `analytics.read`  
Property inventory snapshot (total, active, published, reserved, sold, draft, by_status). Not time-ranged.

### GET `/analytics/employees`

**Authorization:** `analytics.read` (manager+ scope; assigned-scope roles get `[]`)  
`{ range, employees: [ { employee_id, name, leads, won, lost, site_visits, conversion_rate } ] }` — sorted by won desc.

### GET `/analytics/funnel`

**Authorization:** `analytics.read`  
`{ range, funnel: [ { key, label, count } ] }` — New → Contacted → Qualified → Site Visit → Negotiation → Won (stage-or-beyond, monotonically non-increasing).

### GET `/analytics/sources`

**Authorization:** `analytics.read`  
`{ range, sources: [ { source, count } ] }` — lead counts by source, desc.

### GET `/analytics/conversions`

**Authorization:** `analytics.read`  
`{ range, conversion_rate, total_leads, won, lost, monthly_conversion: [ { month, leads, won, conversion_rate } ] }`.

### GET `/analytics/revenue`

**Authorization:** `analytics.read`  
`{ range, currency, won_deals, won_amount, avg_deal_value }` — revenue recognised on close date (`closed_at`); deal value = property price → budget_max → budget_min.

---

### GET `/platform/analytics/dashboard`

**Authorization:** `platform.analytics.read` (Super Admin only — **no** tenant scope)  
Cross-tenant platform KPIs.

**Response 200:**
```json
{
  "data": {
    "range": { "range": "30d", "from": "...", "to": "..." },
    "organizations": { "total": 40, "active": 22, "trial": 12, "suspended": 3, "past_due": 3 },
    "revenue": { "currency": "INR", "mrr": 480000, "arr": 5760000 },
    "totals": { "users": 310, "properties": 1850, "leads": 9400 },
    "tier_breakdown": [ { "tier": "pro", "count": 18 } ],
    "monthly_growth": [ { "month": "2026-06", "organizations": 5 } ],
    "platform_health": { "status": "healthy", "active_ratio": 55.0 },
    "generated_at": "2026-06-09T..."
  }
}
```

> MRR is estimated from active organizations' tier → subscription plan monthly price; ARR = MRR × 12.

---

## 11. Notifications

> **Phase 5 as-built.** Base path `/api/v1`. Users only ever see their own rows (`user_id` + caller `tenant_id`). Super Admin (`tenant_id` null) sees platform notifications. Realtime: Socket.io namespace `/notifications`, events `notification:received`, `notification:unread_count`, `notification:read`.

### GET `/notifications`

**Authorization:** `notifications.read`  
**Query:** `page`, `per_page`, `filter[type]`, `filter[is_read]`  
**Response:** `{ data: Notification[], meta: { page, per_page, total, total_pages } }`

---

### GET `/notifications/unread-count`

**Authorization:** `notifications.read`  
**Response:** `{ data: { unread_count: number } }`

---

### PATCH `/notifications/:id/read`

**Authorization:** `notifications.read`  
**Response:** `{ data: { id, is_read: true, unread_count } }` + realtime `notification:read`

---

### PATCH `/notifications/read-all`

**Authorization:** `notifications.read`  
**Response:** `{ data: { updated: number, unread_count: 0 } }`

---

### GET `/notification-preferences`

**Authorization:** `notifications.read`  
**Response:** `{ data: PreferenceItem[] }` — one row per automation rule with effective toggles.

---

### PATCH `/notification-preferences`

**Authorization:** `notifications.read`  
**Body:** `{ preferences: [{ event_key, in_app, email }] }`

---

### GET `/notification-templates` (admin)

**Authorization:** `notifications.templates.manage`  
**Response:** `{ data: { templates, system_defaults } }`

---

### POST `/notification-templates` (admin)

**Authorization:** `notifications.templates.manage`  
**Body:** `{ key, channel, type, priority?, title_template, body_template, email_subject_template?, is_active? }`

---

### PATCH `/notification-templates/:id` (admin)

**Authorization:** `notifications.templates.manage`

---

## 12. Billing

> **Phase 7 as-built.** Base path `/api/v1/billing`. Tenant routes require JWT,
> `TenantGuard`, and `billing.*` permissions. Webhooks are public but require
> Razorpay HMAC signature validation and idempotency by provider event id.

### GET `/billing/plans`

**Authorization:** `billing.plans.read`  
**Response:** active Starter / Pro / Enterprise plans with prices, limits, storage, features.

---

### GET `/billing/subscription`

**Authorization:** `billing.subscription.read`  
**Response:** current tenant subscription, plan, status, billing cycle, period, trial, cancellation flag.

---

### POST `/billing/subscribe`

**Authorization:** `billing.subscription.update`  
**Request:** `{ "plan_code": "pro", "billing_cycle": "monthly", "coupon_code": "OPTIONAL" }`  
**Response:** subscription + provider checkout payload.

---

### POST `/billing/change-plan`

**Authorization:** `billing.subscription.update`  
**Request:** `{ "plan_code": "starter|pro|enterprise", "billing_cycle": "monthly|yearly" }`  
**Behavior:** Updates tenant plan immediately, records audit, emits billing notification event.

---

### POST `/billing/cancel`

**Authorization:** `billing.subscription.update`  
**Request:** `{ "at_period_end": true }`  
**Behavior:** Sets `cancel_at_period_end` or cancels immediately.

---

### GET `/billing/invoices`

**Authorization:** `billing.invoices.read`  
**Response:** tenant invoice list with subtotal, GST, discount, total, status, PDF URL.

---

### GET `/billing/usage`

**Authorization:** `billing.usage.read`  
**Response:** current usage counters and plan limits for properties, employees, storage, AI minutes.

---

### POST `/billing/webhooks/razorpay`

**Authorization:** HMAC signature (no JWT)  
**Idempotent:** by provider event id in `billing_webhook_events`.  
**Handled events:** `payment.captured`, `payment.failed`, `subscription.renewed`, `subscription.cancelled`, plus Razorpay-compatible `subscription.activated` / `subscription.charged`.

---

### GET `/platform/billing/metrics`

**Authorization:** `platform.billing.read` (Super Admin only — no tenant guard)  
**Response:** MRR, ARR, paid revenue, invoice health, churn, plan distribution, subscription health.

---

## 13. Audit

### GET `/audit-logs`

**Authorization:** `audit.logs.read` (admin+)  
**Query:** `action`, `entity_type`, `entity_id`, `actor_email`, `date_from` (ISO), `date_to` (ISO), `page`, `per_page`. Super Admin may pass `tenant_id`.  
**Response:** paginated audit entries with `actor`, `action`, `entity_type`, `entity_id`, `before`, `after`, `ip_address`, `user_agent`, `created_at`.

---

### GET `/audit-logs/export`

**Authorization:** `audit.logs.export` (Owner/Admin)  
**Produces:** `text/csv` (RFC 4180 escaped), `Content-Disposition: attachment; filename="audit-logs.csv"`.  
**Query:** same filters as `GET /audit-logs` (no pagination — capped export).

---

## 14. Settings & Enterprise (Phase 9)

> Base path `/api/v1/settings`. All authenticated routes require JWT + `TenantGuard`
> + the listed permission. Settings are stored one row per category in
> `tenant_settings` and returned merged with platform defaults. Responses use the
> standard `{ data, meta }` envelope.

### GET `/settings`

**Authorization:** `settings.read`  
**Response:** every settings category (branding, seo, website, features, configuration, white_label) merged with defaults.

---

### GET/PATCH `/settings/branding`

**GET Authorization:** `settings.read` · **PATCH Authorization:** `settings.branding.manage`  
**Body (PATCH):** `{ logo_url?, favicon_url?, primary_color?, secondary_color?, font_family?, email_branding?, pdf_branding? }` (deep-merged).

---

### GET/PATCH `/settings/seo`

**GET:** `settings.read` · **PATCH:** `settings.seo.manage`  
**Body:** `{ meta_title?, meta_description?, open_graph?, twitter_card?, default_schema?, robots?, sitemap? }`.

---

### GET/PATCH `/settings/website`

**GET:** `settings.read` · **PATCH:** `settings.website.manage`  
**Body:** `{ hero_title?, hero_subtitle?, contact?, social_links?, testimonials?, featured_sections?, footer? }`.

---

### GET/PATCH `/settings/features`

**GET:** `settings.read` · **PATCH:** `settings.features.manage` (Owner)  
**Body:** `{ chat?, ai?, billing?, crm?, website?, analytics?, notifications? }` — booleans, DB-resolved (no hard-coded flags).

---

### GET/PATCH `/settings/configuration`

**GET:** `settings.read` · **PATCH:** `settings.configuration.manage`  
**Body:** `{ timezone?, currency?, language?, date_format?, number_format?, business_hours? }`. Indian defaults: `Asia/Kolkata`, `INR`, `en`, `DD/MM/YYYY`, `en-IN`.

---

### GET/PATCH `/settings/white-label`

**GET:** `settings.read` · **PATCH:** `settings.whitelabel.manage` (Owner)  
**Body:** `{ enabled?, hide_branding?, custom_logo_url?, custom_favicon_url?, primary_color?, secondary_color?, email_sender?, custom_login? }`.

---

### GET/POST `/settings/domains`

**GET:** `settings.read` · **POST:** `settings.domains.manage`  
**POST Body:** `{ domain, is_primary? }`. Returns the domain with `verification_token` and `dns_records` (TXT for verification, CNAME for routing).

---

### GET/PATCH/DELETE `/settings/domains/:id`

**GET:** `settings.read` · **PATCH/DELETE:** `settings.domains.manage`  
**PATCH Body:** `{ is_primary?, ssl_status? }`. **DELETE:** soft delete.

---

### POST `/settings/domains/:id/verify`

**Authorization:** `settings.domains.manage`  
**Behavior:** looks up the DNS TXT record and flips `verification_status` to `verified` (+ `verified_at`) on success.

---

### GET `/public/settings`

**Authorization:** Public (no JWT)  
**Query:** `tenant={slug}`  
**Response:** public-safe `branding`, `website`, `seo`, `white_label` for rendering the tenant's public site.

---

## 15. Public Analytics (Phase 9)

### POST `/public/analytics/track`

**Authorization:** Public (no JWT)  
**Query:** `tenant={slug}`  
**Body:** `{ event_type, entity_type?, entity_id?, path?, referrer?, source?, session_id? }`.  
**Event types:** `property_view`, `property_click`, `inquiry_conversion`, `chat_conversion`, `page_view`.  
**Privacy:** client IP is hashed (never stored raw); unknown tenants are a silent no-op.

---

### GET `/analytics/public`

**Authorization:** `analytics.public.read`  
**Query:** `range=today|7d|30d|90d` (or `date_from`/`date_to`).  
**Response:** totals (page/property views, clicks, inquiry & chat conversions), conversion rates, top pages, top properties, traffic sources, referrers.

---

## 15A. AI Agent Platform (Phase 10)

All routes are tenant-scoped (`JwtAuthGuard` + `TenantGuard` + `RequirePermissions`)
unless marked public. Provider-abstracted (mock by default, OpenAI configurable).

### Dashboard & analytics
- **GET `/ai/dashboard?range=7d|30d|90d`** — `ai.dashboard.read`. Conversations, conversions, qualification/conversion/handoff rates, call stats, tokens, estimated cost, cost-per-lead, temperature breakdown.
- **GET `/ai/analytics?range=...`** — `ai.analytics.read`. Same aggregates for reporting.

### Core capabilities
- **POST `/ai/qualify`** — `ai.qualify`. Body `{ text, inquiry_id?, apply? }` → `{ extracted, score, breakdown, temperature, applied }`. Applies to CRM when `apply` or tenant `auto_qualify`.
- **POST `/ai/match`** — `ai.match`. Body `{ text?, inquiry_id?, limit? }` → ranked `{ matches:[{ property_id, title, match_score, reasons }] }`.
- **POST `/ai/intelligence`** — `ai.intelligence`. Body `{ text?, call_id? }` → `{ summary, objections, buying_signals, risk_indicators, recommended_actions, sentiment }`.

### Chat assistant
- **POST `/ai/chat`** — `ai.chat`. Start a conversation `{ message?, channel? }`.
- **POST `/ai/chat/:id/messages`** — `ai.chat`. `{ message }` → `{ reply, handoff_requested, sources, captured_requirements }`.
- **GET `/ai/chat`**, **GET `/ai/chat/:id`** — list / fetch conversations.

### Voice agent & calls
- **GET `/ai/agents`**, **POST `/ai/agents`**, **POST `/ai/agents/:id`** — `ai.settings.manage`. Agent CRUD.
- **GET `/ai/calls`**, **GET `/ai/calls/:id`**, **GET `/ai/calls/:id/transcript`** — `ai.calls.read`.
- **POST `/ai/calls`** — `ai.calls.create`. `{ client_phone, client_name?, inquiry_id?, consent_recorded }` (consent required, BR-AI06). Runs post-call pipeline.
- **POST `/ai/webhooks/voice`** — **Public** (telephony provider). HMAC/idempotent event ingestion.

### Knowledge base (RAG)
- **GET `/ai/knowledge`**, **GET `/ai/knowledge/:id`** — `ai.knowledge.read`.
- **POST `/ai/knowledge`**, **PATCH `/ai/knowledge/:id`**, **DELETE `/ai/knowledge/:id`** — `ai.knowledge.manage` (auto-embeds on write).
- **POST `/ai/knowledge/search`** — `ai.knowledge.read`. `{ query, type? }` → top documents by cosine similarity.

### Prompts, follow-ups, settings
- **GET `/ai/prompts`**, **POST `/ai/prompts`** — `ai.prompts.manage`. List / upsert tenant-scoped prompt overrides.
- **GET `/ai/followups`**, **POST `/ai/followups/generate`**, **PATCH `/ai/followups/:id`** — `ai.followups.read` / `ai.followups.manage`.
- **GET `/ai/settings`** (`ai.settings.read`), **PATCH `/ai/settings`** (`ai.settings.manage`) — provider, automation toggles, handoff keywords.

---

## 16. Health

### GET `/health`

**Authorization:** Public  
**Response:** `{ "status": "ok", "db": "ok", "redis": "ok" }`

---

## 17. Rate Limits

| Surface | Limit |
|---------|-------|
| Public property browse | 120/min/IP |
| Login | 10/min/IP |
| Authenticated API | 600/min/user |
| AI call initiate | 30/hour/tenant |
| Report export | 5/hour/tenant |

---

*RBAC mapping per endpoint: [RBAC.md](./RBAC.md). Schema: [DB_SCHEMA.md](./DB_SCHEMA.md).*
