# RE-OS Database Schema

**Database:** PostgreSQL 16+  
**ORM (planned):** Prisma or TypeORM  
**Convention:** UUID v7 primary keys, `timestamptz`, soft delete via `deleted_at`  
**Last Updated:** 2026-06-05

---

## 1. Global Conventions

### 1.1 Standard Audit Columns (Business Tables)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | PK, default `gen_random_uuid()` or app-generated v7 |
| `tenant_id` | `UUID` | NOT NULL, FK → `organizations.id` |
| `created_by` | `UUID` | NULL, FK → `users.id` |
| `updated_by` | `UUID` | NULL, FK → `users.id` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` |
| `deleted_at` | `TIMESTAMPTZ` | NULL (soft delete) |

### 1.2 Index Strategy

- Every business table: `INDEX idx_{table}_tenant_id (tenant_id) WHERE deleted_at IS NULL`  
- Unique constraints: include `tenant_id` where scoped (e.g. `UNIQUE (tenant_id, slug)`)  
- Foreign keys: `ON DELETE RESTRICT` default; cascades only on join tables with explicit design  

### 1.3 Platform Tables (No tenant_id)

`organizations`, `subscription_plans`, `platform_settings`, `super_admin_users` (optional separate) use platform scope; `organizations` is the tenant root.

---

## 2. Entity Relationship Overview

```
organizations 1──* users
organizations 1──* employees
organizations 1──* properties
organizations 1──* inquiries
organizations 1──* subscriptions
users *──* roles (via user_roles)
roles *──* permissions (via role_permissions)
properties 1──* property_media
inquiries *──* properties (inquiry_properties)
inquiries 1──* inquiry_activities
inquiries 1──* follow_ups
ai_calls *──1 inquiries (optional)
chat_conversations 1──* chat_messages
```

---

## 3. Platform & Tenant

### 3.1 `organizations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Tenant ID |
| `name` | VARCHAR(120) | NOT NULL | Display name |
| `slug` | VARCHAR(63) | UNIQUE NOT NULL | Subdomain key |
| `logo_url` | TEXT | NULL | S3 URL |
| `billing_email` | VARCHAR(255) | NOT NULL | |
| `status` | VARCHAR(20) | NOT NULL | trial, active, suspended, cancelled |
| `tier` | VARCHAR(20) | NOT NULL | basic, pro, enterprise |
| `custom_domain` | VARCHAR(255) | NULL UNIQUE | Phase 9 |
| `timezone` | VARCHAR(50) | default Asia/Kolkata | |
| `settings` | JSONB | default `{}` | Feature flags, branding |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |
| `deleted_at` | TIMESTAMPTZ | NULL | |

**Indexes:** `idx_organizations_slug`, `idx_organizations_status`

---

### 3.2 `organization_usage`

Tracks quota consumption per tenant.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK organizations, UNIQUE |
| `properties_count` | INT | default 0 |
| `employees_count` | INT | default 0 |
| `ai_minutes_used` | INT | default 0 |
| `storage_bytes` | BIGINT | default 0 |
| `updated_at` | TIMESTAMPTZ | |

---

### 3.3 `subscription_plans`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `code` | VARCHAR(50) | UNIQUE (basic, pro, enterprise) |
| `name` | VARCHAR(100) | NOT NULL |
| `price_inr_monthly` | INT | NOT NULL (paise) |
| `price_inr_yearly` | INT | NULL |
| `max_properties` | INT | NOT NULL |
| `max_employees` | INT | NOT NULL |
| `storage_limit_bytes` | BIGINT | 5GB starter, 50GB pro, 0/unlimited enterprise |
| `max_ai_minutes_monthly` | INT | NOT NULL |
| `features` | JSONB | feature flags |
| `is_active` | BOOLEAN | default true |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### 3.4 `subscriptions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK organizations, NOT NULL |
| `plan_id` | UUID | FK subscription_plans |
| `status` | VARCHAR(20) | trialing, active, past_due, cancelled |
| `razorpay_subscription_id` | VARCHAR(100) | NULL UNIQUE |
| `current_period_start` | TIMESTAMPTZ | |
| `current_period_end` | TIMESTAMPTZ | |
| `cancel_at_period_end` | BOOLEAN | default false |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Index:** `idx_subscriptions_tenant_id`

---

## 4. Authentication & Users

### 4.1 `users`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | NULL for super admin only |
| `email` | VARCHAR(255) | NOT NULL |
| `phone` | VARCHAR(20) | NULL |
| `password_hash` | VARCHAR(255) | NULL (OAuth later) |
| `first_name` | VARCHAR(80) | |
| `last_name` | VARCHAR(80) | |
| `avatar_url` | TEXT | NULL |
| `user_type` | VARCHAR(20) | internal, client, super_admin |
| `status` | VARCHAR(20) | active, invited, suspended |
| `email_verified_at` | TIMESTAMPTZ | NULL |
| `last_login_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | |

**Unique:** `UNIQUE (tenant_id, email)` where tenant_id NOT NULL; separate unique for super_admin emails.

**Indexes:** `idx_users_tenant_email`, `idx_users_phone`

---

### 4.2 `refresh_tokens`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK users |
| `jti` | VARCHAR(64) | UNIQUE |
| `token_hash` | VARCHAR(255) | NOT NULL |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `revoked_at` | TIMESTAMPTZ | NULL |
| `user_agent` | TEXT | |
| `ip_address` | INET | |
| `created_at` | TIMESTAMPTZ | |

---

### 4.3 `password_reset_tokens`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK users |
| `token_hash` | VARCHAR(255) | UNIQUE |
| `expires_at` | TIMESTAMPTZ | |
| `used_at` | TIMESTAMPTZ | NULL |

---

### 4.4 `user_invitations`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK + standard tenant audit |
| `email` | VARCHAR(255) | |
| `role_id` | UUID | FK roles |
| `token_hash` | VARCHAR(255) | |
| `expires_at` | TIMESTAMPTZ | |
| `accepted_at` | TIMESTAMPTZ | NULL |

---

## 5. RBAC

### 5.1 `roles`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | NULL = system role template |
| `code` | VARCHAR(50) | org_owner, sales_executive, ... |
| `name` | VARCHAR(100) | |
| `is_system` | BOOLEAN | default false |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Unique:** `UNIQUE (tenant_id, code)`

---

### 5.2 `permissions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `code` | VARCHAR(100) | UNIQUE e.g. `property.create` |
| `module` | VARCHAR(50) | |
| `description` | TEXT | |

---

### 5.3 `role_permissions`

| Column | Type | Constraints |
|--------|------|-------------|
| `role_id` | UUID | PK composite |
| `permission_id` | UUID | PK composite |

---

### 5.4 `user_roles`

| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | UUID | PK composite |
| `role_id` | UUID | PK composite |
| `tenant_id` | UUID | NOT NULL |

---

## 6. Employees

### 6.1 `employees`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK + tenant audit |
| `user_id` | UUID | FK users, UNIQUE per tenant |
| `employee_code` | VARCHAR(20) | NULL |
| `manager_id` | UUID | FK employees, NULL |
| `department` | VARCHAR(50) | NULL |
| `joined_at` | DATE | |
| `status` | VARCHAR(20) | active, inactive |

**Indexes:** `idx_employees_tenant_status`, `idx_employees_manager`

---

## 7. Properties

> **As-built (Phase 2).** The shipped Prisma schema (`backend/prisma/schema.prisma`,
> migration `add_property_domain`) normalizes media into three tables and amenities/tags
> into child tables (instead of JSONB), and uses `type` / `requirement_type` columns.
> The model names below match the generated Prisma client.

### 7.1 `properties`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK (UUID v7) |
| `tenant_id` | UUID | FK organizations, NOT NULL |
| `property_code` | VARCHAR | NOT NULL, e.g. `PROP-A1B2C3` |
| `title` | VARCHAR(200) | NOT NULL |
| `slug` | VARCHAR | NOT NULL |
| `description` | TEXT | NULL |
| `type` | VARCHAR | `residential`, `commercial` |
| `category` | VARCHAR | `flat`, `villa`, `plot`, `office`, `shop`, `warehouse` |
| `requirement_type` | VARCHAR | `buy`, `sell`, `rent` |
| `price` | DECIMAL(14,2) | NULL |
| `maintenance` | DECIMAL(14,2) | NULL |
| `token_amount` | DECIMAL(14,2) | NULL |
| `address` | TEXT | NULL |
| `city` | VARCHAR | NOT NULL |
| `state` | VARCHAR | NULL |
| `country` | VARCHAR | default `India` |
| `pincode` | VARCHAR | NULL |
| `latitude` | DECIMAL(10,7) | NULL |
| `longitude` | DECIMAL(10,7) | NULL |
| `bedrooms` | INT | NULL |
| `bathrooms` | INT | NULL |
| `balconies` | INT | NULL |
| `floor` | INT | NULL |
| `total_floors` | INT | NULL |
| `super_builtup_area` | DECIMAL(10,2) | NULL |
| `carpet_area` | DECIMAL(10,2) | NULL |
| `status` | VARCHAR | `draft`, `pending_review`, `published`, `reserved`, `sold`, `archived` |
| `is_public` | BOOLEAN | default false |
| `meta_title` | VARCHAR | NULL (SEO) |
| `meta_description` | VARCHAR | NULL (SEO) |
| `published_at` | TIMESTAMPTZ | NULL |
| `created_by` / `updated_by` | UUID | audit |
| `created_at` / `updated_at` | TIMESTAMPTZ | audit |
| `deleted_at` | TIMESTAMPTZ | NULL (soft delete) |

**Unique:** `UNIQUE (tenant_id, slug)`, `UNIQUE (tenant_id, property_code)`  
**Indexes:** `(tenant_id, status)`, `(tenant_id, city)`, `(tenant_id, category)`, `(tenant_id, type)`, `(tenant_id, price)`, `(tenant_id, requirement_type)`, `(tenant_id, is_public)`

---

### 7.2 `property_images` / `property_videos` / `property_documents`

Media is normalized into three tables (all FK `property_id` → `properties` `ON DELETE CASCADE`).

**`property_images`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `property_id` | UUID | FK |
| `url` | TEXT | NOT NULL |
| `thumbnail_url` | TEXT | NULL |
| `storage_key` | TEXT | NULL (S3/local key for deletion) |
| `alt_text` | VARCHAR | NULL |
| `sort_order` | INT | default 0 |
| `is_cover` | BOOLEAN | default false |

**`property_videos`**: `id`, `property_id`, `url`, `storage_key`, `title`, `sort_order`.  
**`property_documents`**: `id`, `property_id`, `name`, `url`, `storage_key`, `doc_type`.

---

### 7.3 `property_amenities` / `property_tags`

| Table | Columns | Unique |
|-------|---------|--------|
| `property_amenities` | `id`, `property_id`, `name` | `UNIQUE (property_id, name)` |
| `property_tags` | `id`, `property_id`, `tag` | `UNIQUE (property_id, tag)` |

---

### 7.4 `property_assignments`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | NOT NULL |
| `property_id` | UUID | FK |
| `employee_id` | UUID | FK employees |
| `is_primary` | BOOLEAN | default false (BR-P06: ≤1 primary) |
| `assigned_by` | UUID | actor user id |
| `assigned_at` | TIMESTAMPTZ | default now |

**Unique:** `UNIQUE (tenant_id, property_id, employee_id)`

---

### 7.5 `property_history`

Immutable change log for the property audit trail.

| Column | Type | |
|--------|------|--|
| `id` | UUID | PK |
| `tenant_id` | UUID | |
| `property_id` | UUID | FK `ON DELETE CASCADE` |
| `change_type` | VARCHAR | `created`, `property_updated`, `price_changed`, `status_changed`, `assignment_changed` |
| `changed_fields` | JSONB | `{ from, to }` diff |
| `changed_by` | UUID | NULL |
| `changed_by_email` | VARCHAR | NULL (denormalized for display) |
| `created_at` | TIMESTAMPTZ | |

**Index:** `(tenant_id, property_id, created_at)`

---

## 8. CRM

### 8.1 `pipeline_stages`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK + tenant audit |
| `code` | VARCHAR(50) | |
| `name` | VARCHAR(100) | |
| `sort_order` | INT | |
| `is_won` | BOOLEAN | |
| `is_lost` | BOOLEAN | |
| `is_default` | BOOLEAN | |

---

### 8.2 `inquiries`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK + tenant audit |
| `inquiry_number` | VARCHAR(20) | human-readable per tenant |
| `client_user_id` | UUID | FK users NULL |
| `client_name` | VARCHAR(120) | NOT NULL |
| `client_phone` | VARCHAR(20) | NOT NULL |
| `client_email` | VARCHAR(255) | NULL |
| `budget_min` | DECIMAL(14,2) | NULL |
| `budget_max` | DECIMAL(14,2) | NULL |
| `requirement_type` | VARCHAR(30) | buy_residential, ... |
| `requirement_notes` | TEXT | |
| `source` | VARCHAR(30) | website, manual, ai_call, chat, import |
| `stage_id` | UUID | FK pipeline_stages |
| `assigned_employee_id` | UUID | FK employees NULL |
| `priority` | VARCHAR(10) | low, medium, high |
| `lead_score` | SMALLINT | 0-100 NULL |
| `lost_reason` | VARCHAR(100) | NULL |
| `closed_at` | TIMESTAMPTZ | NULL |

**Indexes:** `(tenant_id, stage_id)`, `(tenant_id, assigned_employee_id)`, `(tenant_id, client_phone)`

---

### 8.3 `inquiry_properties`

| Column | Type | Constraints |
|--------|------|-------------|
| `inquiry_id` | UUID | PK composite |
| `property_id` | UUID | PK composite |
| `tenant_id` | UUID | NOT NULL |

---

### 8.4 `inquiry_activities`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK + tenant audit |
| `inquiry_id` | UUID | FK |
| `activity_type` | VARCHAR(30) | note, call, email, stage_change, visit |
| `content` | TEXT | |
| `metadata` | JSONB | |

---

### 8.5 `follow_ups`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK + tenant audit |
| `inquiry_id` | UUID | FK |
| `assigned_employee_id` | UUID | FK |
| `due_at` | TIMESTAMPTZ | NOT NULL |
| `completed_at` | TIMESTAMPTZ | NULL |
| `notes` | TEXT | |
| `status` | VARCHAR(20) | pending, completed, skipped |

**Index:** `(tenant_id, due_at) WHERE status = 'pending'`

---

### 8.6 Phase 3 — CRM as built (migration `add_crm_inquiry_domain`)

> The Phase 3 implementation refines §8.1–8.5. Pipeline stage is a **string column** on
> `inquiries` (fixed MVP pipeline enforced in the service layer, BR-C02) rather than a
> `pipeline_stages` table — this avoids per-tenant stage drift while the pipeline is fixed.
> Dedicated `inquiry_history`, `inquiry_assignments`, `site_visits`, and `lead_sources`
> tables were added. All tables carry `tenant_id` and audit columns; `inquiries` is soft
> deleted via `deleted_at`.

**`lead_sources`** — `id`, `tenant_id`, `name`, `code` NULL, `is_active`, `is_system`,
`created_by`, `created_at`, `updated_at`. Unique `(tenant_id, name)`. Default sources seeded
per tenant (Website, Property Portal, WhatsApp, Facebook, Google Ads, Referral, Walk-in).

**`inquiries`** — `id`, `tenant_id`, `inquiry_code` (unique per tenant), `client_name`,
`phone`, `email`, `whatsapp`, `property_id` FK NULL, `assigned_employee_id` FK NULL,
`source_id` FK lead_sources NULL, `source_name` (snapshot), `budget_min`/`budget_max`
DECIMAL(14,2), `requirement_type`, `preferred_location`, `property_type`, `bedrooms`,
`purchase_timeline`, `stage` VARCHAR (default `NEW`), `priority` (low/medium/high),
`temperature` (hot/warm/cold), `lead_score` SMALLINT 0–100 NULL, `remarks`, `lost_reason`,
`no_property_reason`, `closed_at`, `created_by`, `updated_by`, `created_at`, `updated_at`,
`deleted_at`.  
**Indexes:** `(tenant_id, stage)`, `(tenant_id, assigned_employee_id)`,
`(tenant_id, source_id)`, `(tenant_id, created_at)`, `(tenant_id, phone)`,
`(tenant_id, email)`, `(tenant_id, property_id)`, unique `(tenant_id, inquiry_code)`.

**`inquiry_notes`** — `id`, `tenant_id`, `inquiry_id` FK, `note` TEXT, `created_by`,
`created_by_email`, `created_at`. Index `(inquiry_id, created_at)`.

**`inquiry_activities`** — `id`, `tenant_id`, `inquiry_id` FK, `activity_type`
(inquiry_created, inquiry_assigned, stage_changed, note_added, followup_created,
site_visit_scheduled, site_visit_completed, closed_won, closed_lost), `content` NULL,
`metadata` JSONB, `actor_id`, `actor_email`, `created_at`. Index `(inquiry_id, created_at)`.

**`inquiry_followups`** — `id`, `tenant_id`, `inquiry_id` FK, `assigned_employee_id` FK NULL,
`followup_date` DATE, `followup_time` VARCHAR NULL, `followup_type`
(call/meeting/whatsapp/site_visit/email), `status`
(pending/completed/missed/rescheduled), `notes`, `completed_at`, `created_by`,
`created_at`, `updated_at`. Indexes `(tenant_id, followup_date)`, `(inquiry_id)`.

**`inquiry_assignments`** — `id`, `tenant_id`, `inquiry_id` FK, `employee_id` FK,
`previous_employee_id` NULL, `assigned_by`, `created_at`. Index `(inquiry_id, created_at)`.

**`inquiry_history`** — `id`, `tenant_id`, `inquiry_id` FK, `change_type`
(created/inquiry_updated/stage_changed/assignment_changed/closed), `changed_fields` JSONB,
`changed_by`, `changed_by_email`, `created_at`. Index `(inquiry_id, created_at)`.

**`site_visits`** — `id`, `tenant_id`, `inquiry_id` FK, `property_id` FK NULL,
`employee_id` FK NULL, `scheduled_at`, `completed_at` NULL, `status`
(scheduled/completed/cancelled/no_show), `notes`, `created_by`, `created_at`, `updated_at`.
Indexes `(tenant_id, scheduled_at)`, `(inquiry_id)`, `(tenant_id, employee_id)`,
`(tenant_id, property_id)`.

---

## 9. AI Agent

### 9.1 `ai_calls`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK + tenant audit |
| `inquiry_id` | UUID | FK NULL |
| `client_phone` | VARCHAR(20) | NOT NULL |
| `direction` | VARCHAR(10) | inbound, outbound |
| `status` | VARCHAR(20) | scheduled, in_progress, completed, failed |
| `started_at` | TIMESTAMPTZ | |
| `ended_at` | TIMESTAMPTZ | |
| `duration_seconds` | INT | |
| `recording_url` | TEXT | NULL |
| `provider_call_id` | VARCHAR(100) | NULL |
| `budget_captured` | DECIMAL(14,2) | NULL |
| `requirement_summary` | TEXT | |
| `interest_level` | VARCHAR(10) | high, medium, low |
| `lead_score` | SMALLINT | |
| `next_action` | VARCHAR(255) | |
| `consent_recorded` | BOOLEAN | default false |

---

### 9.2 `ai_call_transcripts`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `call_id` | UUID | FK ai_calls UNIQUE |
| `tenant_id` | UUID | |
| `raw_transcript` | TEXT | |
| `structured_data` | JSONB | extracted entities |
| `summary` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

---

## 10. Chat (Phase 6 — as-built)

> Migration: `20260609150000_add_chat_domain`. Soft delete on `conversations` and `messages`.

### 10.1 `conversations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK organizations |
| `conversation_code` | VARCHAR | unique per tenant |
| `type` | VARCHAR | website, inquiry, property, support, internal |
| `status` | VARCHAR | open, assigned, waiting, closed, archived |
| `subject` | VARCHAR | optional |
| `property_id` / `property_slug` | UUID / VARCHAR | property context |
| `inquiry_id` | UUID | FK NULL |
| `client_name` / `client_email` / `client_phone` | VARCHAR | visitor snapshot |
| `client_identifier` | VARCHAR | anonymous widget session id |
| `assigned_employee_id` | UUID | FK employees |
| `last_message_at` / `last_message_preview` | TIMESTAMPTZ / VARCHAR | inbox sort |
| `created_by` / `closed_by` / `closed_at` | UUID / TIMESTAMPTZ | audit |
| `deleted_at` | TIMESTAMPTZ | soft delete |

### 10.2 `conversation_participants`

Per-user unread via `last_read_at` + `last_read_message_id`. Types: employee, client, system.

### 10.3 `messages`

| Column | Type | Notes |
|--------|------|-------|
| `sender_type` | VARCHAR | employee, client, system |
| `message_type` | VARCHAR | text, image, file, system |
| `content` | TEXT | body or attachment label |
| `status` | VARCHAR | sent, delivered, read, failed |

**Index:** `(conversation_id, created_at)`

### 10.4 `message_attachments`

Stored via shared `StorageService` (S3 / local). Columns: `storage_key`, `url`, `name`, `content_type`, `kind`, `size_bytes`.

### 10.5 `conversation_assignments`, `conversation_activities`, `conversation_tags`

Assignment history, audit timeline, and normalized tags respectively.

---

## 11. Notifications

> **As-built (Phase 5).** Five tables; channels `in_app` and `email` (WhatsApp deferred). Migration: `20260609140000_add_notifications_domain`.

### 11.1 `notifications`

In-app notification inbox per user (tenant-scoped; `tenant_id` NULL for platform/Super Admin).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK organizations, NULL = platform |
| `user_id` | UUID | FK users |
| `title` | VARCHAR | |
| `message` | TEXT | |
| `type` | VARCHAR | SYSTEM, CRM, PROPERTY, BILLING, CHAT, AI_AGENT |
| `priority` | VARCHAR | LOW, MEDIUM, HIGH, CRITICAL |
| `channel` | VARCHAR | `in_app` (persisted row; email tracked in delivery log) |
| `event_key` | VARCHAR | e.g. `crm.inquiry.assigned` |
| `action_url` | VARCHAR | deep link |
| `entity_type` / `entity_id` | VARCHAR / UUID | related record |
| `metadata` | JSONB | template context |
| `is_read` | BOOLEAN | default false |
| `read_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | |

Indexes: `(user_id, is_read)`, `(tenant_id, created_at)`.

---

### 11.2 `notification_preferences`

Per-user channel toggles per `event_key`. Defaults ON when no row exists.

| Column | Type | |
|--------|------|--|
| `id` | UUID | PK |
| `tenant_id` | UUID | NULL ok |
| `user_id` | UUID | FK users |
| `event_key` | VARCHAR | unique per user |
| `in_app` | BOOLEAN | default true |
| `email` | BOOLEAN | default true |

---

### 11.3 `notification_templates`

Tenant overrides + system defaults (`tenant_id` NULL, `is_system` true).

| Column | Type | |
|--------|------|--|
| `id` | UUID | PK |
| `tenant_id` | UUID | NULL = system |
| `key` | VARCHAR | event key |
| `channel` | VARCHAR | `in_app` \| `email` |
| `type` / `priority` | VARCHAR | |
| `title_template` / `body_template` | TEXT | `{{var}}` syntax |
| `email_subject_template` | VARCHAR | nullable |
| `is_active` / `is_system` | BOOLEAN | |
| `created_by` | UUID | nullable |

Unique: `(tenant_id, key, channel)`.

---

### 11.4 `notification_delivery_logs`

Outbound delivery audit (in-app + email).

| Column | Type | |
|--------|------|--|
| `id` | UUID | PK |
| `notification_id` | UUID | FK, nullable |
| `user_id` | UUID | |
| `channel` | VARCHAR | |
| `status` | VARCHAR | pending, sent, failed, skipped |
| `provider` | VARCHAR | dev, in_app, … |
| `error` | TEXT | |
| `attempts` | INT | |
| `sent_at` | TIMESTAMPTZ | |

---

### 11.5 `notification_queue`

Durable outbox / job audit alongside BullMQ (or in-memory queue in dev).

| Column | Type | |
|--------|------|--|
| `id` | UUID | PK |
| `queue` | VARCHAR | notifications, email, reminders |
| `job_type` | VARCHAR | dispatch, email, reminder |
| `payload` | JSONB | |
| `status` | VARCHAR | pending → completed/failed |
| `available_at` | TIMESTAMPTZ | supports delayed reminders |

---

## 12. Billing (Phase 7 — as-built)

> Migration: `20260610110000_add_billing_domain`. The billing module uses Controller →
> Service → Repository layering, a `PaymentProvider` abstraction (`MockProvider` in dev,
> `RazorpayProvider` for HMAC webhooks), tenant-scoped records, and idempotent webhook
> processing via `billing_webhook_events.provider_event_id`.

### 12.1 `subscriptions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK organizations, NOT NULL |
| `plan_id` | UUID | FK subscription_plans |
| `status` | VARCHAR | trial, active, past_due, cancelled, expired, suspended |
| `billing_cycle` | VARCHAR | monthly, yearly |
| `provider` | VARCHAR | mock, razorpay |
| `provider_subscription_id` | VARCHAR | UNIQUE NULL |
| `current_period_start` / `current_period_end` | TIMESTAMPTZ | |
| `trial_ends_at` | TIMESTAMPTZ | |
| `cancel_at_period_end` / `cancelled_at` | BOOLEAN / TIMESTAMPTZ | |
| `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` | audit | |

### 12.2 `invoices`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK organizations |
| `subscription_id` | UUID | FK subscriptions |
| `plan_id` | UUID | FK subscription_plans |
| `invoice_number` | VARCHAR | UNIQUE `(tenant_id, invoice_number)` |
| `subtotal`, `tax`, `discount`, `total` | INT | paise |
| `currency` | VARCHAR | INR |
| `status` | VARCHAR | draft, issued, paid, failed, void |
| `pdf_url` | TEXT | NULL |
| `provider_invoice_id` | VARCHAR | UNIQUE NULL |
| `issued_at`, `due_at`, `paid_at` | TIMESTAMPTZ | |

### 12.3 `payments` / `payment_attempts`

`payments` stores captured/refunded payment records linked to invoice/subscription.
`payment_attempts` stores failed/created provider attempts for dunning and support.

Key columns: `tenant_id`, `subscription_id`, provider IDs, `amount`, `currency`, `status`,
`method`, `metadata`, `paid_at` / `attempted_at`.

### 12.4 `coupons`

Tenant-scoped or platform coupons: `tenant_id` nullable, `code`, `discount_type`,
`discount_value`, `max_redemptions`, `redeemed_count`, `starts_at`, `expires_at`,
`is_active`, soft delete.

### 12.5 `usage_metrics`

Period metrics beyond current counters: `tenant_id`, `metric_key`, `metric_value`,
`period_start`, `period_end`, `metadata`. Unique `(tenant_id, metric_key, period_start)`.

### 12.6 `billing_webhook_events`

Provider webhook idempotency and audit: `provider`, `provider_event_id` UNIQUE,
`event_type`, `payload`, `signature_valid`, `processed_at`, `processing_error`.

---

## 13. Analytics

### 13.1 `analytics_events`

| Column | Type | |
|--------|------|--|
| `id` | UUID | PK |
| `tenant_id` | UUID | |
| `event_name` | VARCHAR(80) | |
| `actor_id` | UUID | NULL |
| `entity_type` | VARCHAR(50) | |
| `entity_id` | UUID | |
| `properties` | JSONB | |
| `occurred_at` | TIMESTAMPTZ | |

**Partition:** by month on `occurred_at` (Phase 4+).

---

### 13.2 `analytics_daily_snapshots`

| Column | Type | |
|--------|------|--|
| `id` | UUID | PK |
| `tenant_id` | UUID | |
| `snapshot_date` | DATE | |
| `metrics` | JSONB | inquiries_new, conversion_rate, ... |

**Unique:** `UNIQUE (tenant_id, snapshot_date)`

---

## 14. Audit & Feature Flags

### 14.1 `audit_logs`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | NULL for platform actions |
| `actor_id` | UUID | NULL |
| `actor_email` | VARCHAR(255) | denormalized |
| `action` | VARCHAR(50) | create, update, delete, login |
| `entity_type` | VARCHAR(50) | |
| `entity_id` | UUID | |
| `before_state` | JSONB | NULL |
| `after_state` | JSONB | NULL |
| `ip_address` | INET | |
| `user_agent` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL |

**Index:** `(tenant_id, created_at DESC)`, `(entity_type, entity_id)`

**Immutability:** INSERT only; no UPDATE/DELETE.

---

### 14.2 `feature_flags`

| Column | Type | |
|--------|------|--|
| `id` | UUID | PK |
| `code` | VARCHAR(50) | UNIQUE |
| `description` | TEXT | |
| `default_enabled` | BOOLEAN | |

---

### 14.3 `tenant_feature_flags`

| Column | Type | |
|--------|------|--|
| `tenant_id` | UUID | PK composite |
| `feature_flag_id` | UUID | PK composite |
| `enabled` | BOOLEAN | |

---

## 15. SEO & Public

### 15.1 `seo_pages` (Programmatic)

| Column | Type | |
|--------|------|--|
| `id` | UUID | PK + tenant audit |
| `page_type` | VARCHAR(30) | city, area, builder |
| `slug_path` | VARCHAR(500) | |
| `title` | VARCHAR(255) | |
| `meta_description` | TEXT | |
| `content` | TEXT | |
| `is_indexable` | BOOLEAN | |

---

### 15.2 `client_saved_properties`

| Column | Type | |
|--------|------|--|
| `user_id` | UUID | PK composite |
| `property_id` | UUID | PK composite |
| `tenant_id` | UUID | |

---

## 16. Soft Delete Strategy

- Application queries default: `WHERE deleted_at IS NULL`  
- Unique constraints use partial indexes: `UNIQUE (tenant_id, slug) WHERE deleted_at IS NULL`  
- Hard delete: Super Admin only, GDPR erasure job, cascades documented per table  
- Restore: set `deleted_at = NULL` within 30-day window (configurable)  

---

## 17. Migration Phasing

| Phase | New Tables |
|-------|------------|
| 1 | organizations, users, roles, permissions, employees, refresh_tokens, audit_logs (basic) |
| 2 | properties, property_media, property_assignments |
| 3 | pipeline_stages, inquiries, inquiry_*, follow_ups |
| 4 | analytics_* |
| 5 | notification_* |
| 6 | chat_* |
| 7 | subscriptions, invoices, payments, payment_attempts, coupons, usage_metrics, billing_webhook_events |
| 8 | ai_calls, ai_call_transcripts |
| 9 | feature_flags, seo_pages, custom domains |

---

*API mapping: [API_SPEC.md](./API_SPEC.md). Access control: [RBAC.md](./RBAC.md).*
