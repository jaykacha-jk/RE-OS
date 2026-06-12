# RE-OS System Design

**Version:** 1.0  
**Last Updated:** 2026-06-05

---

## 1. Architecture Overview

RE-OS uses a **modular monolith** backend with a **Next.js** frontend. Bounded contexts map to NestJS modules. Cross-cutting concerns live in `common/`. The design optimizes for fast MVP delivery while preserving clear extraction seams for future microservices.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Clients                                   │
│  Browser (Next.js) │ Mobile Web │ Public SEO │ Webhooks          │
└────────────┬────────────────────────────────────────────────────┘
             │ HTTPS
┌────────────▼────────────────────────────────────────────────────┐
│  AWS ALB + WAF                                                     │
└────────────┬────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────────┐
│  ECS Service: API (NestJS)          ECS Service: Worker (BullMQ) │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Auth/RBAC    │  │ Property     │  │ CRM          │  ...     │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└───┬─────────┬─────────┬─────────┬─────────┬──────────────────────┘
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
 PostgreSQL  Redis   Elastic   S3      Socket.io
                              (adapter via Redis)
```

---

## 2. Modular Monolith Structure

### 2.1 Backend Modules (Bounded Contexts)

| Module | Responsibility | Future Service Candidate |
|--------|----------------|--------------------------|
| `auth` | Login, JWT, refresh, sessions | Auth service |
| `tenant` | Organizations, settings, domains | Tenant service |
| `users` | User accounts, profile | Auth service |
| `rbac` | Roles, permissions | Auth service |
| `employees` | Employee records, hierarchy | HR-lite service |
| `properties` | Inventory, media, assignment | Property service |
| `crm` | Inquiries, pipeline, activities | CRM service |
| `search` | Elasticsearch indexing/query | Search service |
| `notifications` | Email, in-app, WhatsApp | Notification service |
| `chat` | Conversations, messages | Chat service |
| `billing` | Plans, subscriptions, Razorpay | Billing service |
| `ai-agent` | Calls, transcripts, scoring | AI service |
| `analytics` | Events, aggregates | Analytics service |
| `audit` | Immutable audit trail | Shared audit bus |
| `platform` | Super admin operations | Admin service |

### 2.2 Layering (Per Module)

```
Controller  → HTTP, DTO validation, auth guards only
Service     → Business logic, transactions, domain events
Repository  → Prisma/TypeORM queries, tenant scoping
Entity      → Domain model (optional rich entities)
Mapper      → Entity ↔ DTO
```

**Rule:** Controllers never call repositories directly.

### 2.3 Frontend Structure

```
app/           → Routes (App Router), layouts, loading/error
features/      → Feature slices (property, crm, auth)
components/    → Shared UI (shadcn wrappers)
services/      → API clients (typed)
hooks/         → TanStack Query hooks
types/         → Shared TypeScript types (generated from OpenAPI where possible)
```

### 2.4 Public Website + SEO Platform

Phase 8 expands the public Next.js surface into a tenant-aware, SSR-first real-estate website. Public routes must remain read-only except lead capture and chat initiation, and must consume public-safe backend DTOs rather than internal admin APIs.

| Route family | Purpose | Backend contract |
|--------------|---------|------------------|
| `/listings` and `/listings/[slug]` | Compatibility public listing/detail routes | `GET /api/v1/public/properties` |
| `/buy/[city]`, `/rent/[city]`, `/commercial/[city]` | Indexable city/category hubs | `GET /api/v1/public/properties` with tenant + filters |
| `/buy/[city]/[slug]`, `/rent/[city]/[slug]`, `/commercial/[city]/[slug]` | Canonical property detail URLs | `GET /api/v1/public/properties/{slug}` |
| `/sitemap.xml`, `/robots.txt` | Tenant-aware crawler discovery and policy | Public listing API, capped for performance |
| Inquiry forms | CRM lead creation | `POST /api/v1/public/{tenant_slug}/inquiries` |

Public website rules:

- Tenant resolution starts with subdomain/custom-domain headers when available, then falls back to the `tenant` query param for local development.
- Property pages are canonicalized by `requirement_type`, `city`, and property slug. Legacy `/listings/[slug]?tenant=` pages should point canonicals to the SEO route.
- Public APIs return only published, public, non-deleted listings; no assignments, audit fields, tenant IDs, or internal notes.
- Lead capture enters the CRM through `CrmService` so BR-C01 duplicate detection, audit logs, and `inquiry.created` domain events stay intact.
- Programmatic city/area pages follow BR-S01 quality gates before indexing; thin pages are allowed to render but must be noindexed.

---

## 3. Multi-Tenant Architecture

### 3.1 Tenant Model

- **Tenant** = `organizations` row  
- **Tenant context** resolved from:
  1. JWT claim `tenant_id` (internal users)
  2. Subdomain `{org}.reos.app` → org lookup (public + tenant UI)
  3. Custom domain mapping table (Phase 9)

### 3.2 Isolation Strategy

| Layer | Mechanism |
|-------|-----------|
| Application | `TenantContext` middleware sets `tenantId` per request |
| Repository | Base repository enforces `WHERE tenant_id = :tenantId` |
| Database | Composite indexes `(tenant_id, ...)` on all business tables |
| Super Admin | Separate guard; explicit `X-Tenant-Id` header for impersonation with audit |

### 3.3 Tenant Provisioning Flow

1. Super Admin creates organization  
2. Transaction: org row + default roles + owner invite + usage quota row  
3. Event `organization.created` → seed notification templates  
4. Async job: create S3 prefix `tenants/{id}/`  
5. Async job: Elasticsearch index alias `properties-{tenant_id}`  

---

## 4. Event-Driven Design

### 4.1 Domain Events (In-Process)

Use NestJS `EventEmitter2` for synchronous side effects within the monolith:

| Event | Producers | Consumers |
|-------|-----------|-----------|
| `inquiry.created` | CRM | Notifications, Analytics |
| `inquiry.stage_changed` | CRM | Notifications, Audit |
| `property.published` | Property | Search indexer |
| `property.updated` | Property | Search indexer, Audit |
| `employee.created` | Employees | Notifications |
| `billing.plan_changed` | Billing | Notifications, tenant limits cache invalidation |
| `billing.payment_failed` | Billing | Notifications, dunning workflow |
| `billing.invoice_generated` | Billing | Notifications, invoice delivery |
| `billing.subscription_renewed` | Billing | Notifications, revenue analytics |
| `call.completed` | AI Agent | CRM auto-fill, Analytics |

### 4.2 Async Jobs (BullMQ)

| Queue | Jobs |
|-------|------|
| `notifications` | send_email, send_whatsapp, push_in_app |
| `search` | index_property, delete_property_doc |
| `ai` | transcribe_audio, summarize_call, score_lead |
| `billing` | process_webhook, generate_invoice_pdf |
| `exports` | generate_report_csv |

### 4.3 Future Event Bus

Migrate to SNS/SQS or Kafka when:
- Worker CPU > 70% sustained
- Need replay / multiple consumers per event
- Extract 2+ microservices

Event envelope standard:

```json
{
  "event_id": "uuid",
  "event_type": "inquiry.created",
  "tenant_id": "uuid",
  "occurred_at": "ISO8601",
  "payload": {},
  "metadata": { "correlation_id": "uuid", "actor_id": "uuid" }
}
```

---

## 5. Redis Strategy

| Use Case | Key Pattern | TTL |
|----------|-------------|-----|
| Session / refresh token blocklist | `rt:{jti}` | match token expiry |
| Rate limiting | `rl:{ip}:{route}` | 60s–3600s |
| Tenant settings cache | `tenant:{id}:settings` | 5m |
| Plan limits cache | `tenant:{id}:limits` | 5m |
| Property detail hot cache | `prop:{tenant}:{id}` | 2m |
| Socket.io adapter | Redis pub/sub | — |
| BullMQ | internal | — |
| Distributed lock | `lock:{resource}` | 30s |

**Invalidation:** On `billing.plan_changed`, `billing.subscription_renewed`, `property.updated`, `tenant.settings.updated` — delete relevant keys.

---

## 6. Queue Strategy

- **Default:** BullMQ on Redis  
- **Retries:** Exponential backoff, max 5 attempts  
- **DLQ:** `*-failed` queues monitored by Grafana alert  
- **Idempotency:** Job payload includes `idempotency_key`; workers check processed keys in Redis  
- **Priority:** `notifications` > `search` > `exports` > `ai`

**Critical path:** Payment webhooks are verified by provider HMAC and stored in `billing_webhook_events` for idempotency before service processing. Dedicated `billing-webhooks` queue with concurrency 1 per tenant remains the extraction path when webhook volume grows.

---

## 7. Search Strategy (Elasticsearch)

### 7.1 Indices

| Index | Documents | Shards (start) |
|-------|-----------|----------------|
| `properties` | Property listing cards | 3 |
| `inquiries` | Optional Phase 4+ | 3 |

### 7.2 Document Shape (Property)

```json
{
  "tenant_id": "uuid",
  "property_id": "uuid",
  "title": "string",
  "slug": "string",
  "city": "string",
  "area": "string",
  "type": "buy|rent",
  "category": "flat",
  "price": 8500000,
  "bhk": 3,
  "status": "available",
  "location": { "lat": 23.0, "lon": 72.5 },
  "amenities": ["gym"],
  "published_at": "ISO8601"
}
```

### 7.3 Query Patterns

- Tenant filter **mandatory** in every query (`filter: term tenant_id`)  
- Public search: only `status: available` and `is_public: true`  
- Facets: city, area, bhk, price range, category  
- Geo: `geo_distance` for map view  

### 7.4 Sync

- On write: enqueue `index_property` job (debounce 2s bulk optional)  
- Full reindex: admin endpoint per tenant (rate limited)  

---

## 8. Storage Strategy (S3)

| Path | Content |
|------|---------|
| `tenants/{tenant_id}/properties/{id}/images/{uuid}.webp` | Property images |
| `tenants/{tenant_id}/properties/{id}/docs/{uuid}.pdf` | Floor plans |
| `tenants/{tenant_id}/org/logo.webp` | Org logo |
| `tenants/{tenant_id}/exports/{job_id}.csv` | Report exports |
| `tenants/{tenant_id}/calls/{call_id}/recording.mp3` | Call recordings |

- **Upload:** Presigned PUT from API; max 10MB image, 25MB PDF  
- **CDN:** CloudFront in front of public property assets  
- **Processing:** Lambda/worker generates WebP thumbnails  

---

## 9. Notification Strategy

```
Trigger (domain event)
    → NotificationService.buildPayload()
    → Preference check (user + org)
    → Enqueue channel jobs
        → Email (SES)
        → In-app (DB + Socket.io)
        → WhatsApp (BSP API, Phase 5+)
```

Templates stored per tenant with platform defaults. Unsubscribe honored for marketing emails only; transactional always sent.

---

## 10. Realtime (Socket.io)

- **Namespaces:** `/tenant/{tenant_id}`  
- **Auth:** JWT in handshake; validate `tenant_id` match  
- **Rooms:** `user:{id}`, `chat:{conversation_id}`, `org:broadcast` (managers)  
- **Scale:** Redis adapter; sticky sessions on ALB  

Events: `notification.new`, `chat.message`, `inquiry.updated` (assigned agent only).

---

## 11. API Gateway & Versioning

- Base path: `/api/v1`  
- OpenAPI 3.1 spec generated from NestJS decorators  
- Deprecation: `Sunset` header, 6-month overlap  

Public vs internal:

| Surface | Auth |
|---------|------|
| `/api/v1/public/*` | Optional JWT, rate limited by IP |
| `/api/v1/*` | JWT required |
| `/api/v1/platform/*` | Super Admin role |

---

## 12. CQRS-Ready Patterns (Phase 4+)

- **Writes:** PostgreSQL authoritative  
- **Reads:** Dashboard aggregates materialized in `analytics_daily_snapshots`  
- **Refresh:** Nightly job + on-demand for "today" widgets  

Full CQRS split only if report queries impact OLTP p95.

---

## 13. Scaling Strategy

| Stage | Organizations | Actions |
|-------|---------------|---------|
| 0–500 | < 500 | Single ECS API + 2 workers, RDS db.m6g.large |
| 500–2k | 2k | Read replica, cache hit rate monitoring |
| 2k–10k | 10k | Separate worker service, ES dedicated cluster |
| 10k+ | — | Extract search, notifications, AI to services |

**Horizontal:** Stateless API containers; scale on CPU + request count.  
**Database:** Connection pooling (PgBouncer), partition `audit_logs` by month.  
**Cold data:** Archive closed inquiries > 2 years to S3 parquet (enterprise).

---

## 14. Microservice Migration Plan

**Extraction order (by pain):**

1. **Search** — ES already isolated  
2. **Notifications** — high async volume  
3. **AI Agent** — GPU/CPU heavy, different release cycle  
4. **Chat** — WebSocket scaling  
5. **Billing** — compliance boundary  

**Per service extraction:**

- Move module to repo/subfolder with shared protobuf/OpenAPI contracts  
- Dual-write period via outbox table `integration_outbox`  
- Strangler: route `%` traffic via feature flag  

---

## 15. Observability

| Signal | Tool |
|--------|------|
| Metrics | Prometheus (RED + USE) |
| Dashboards | Grafana |
| Logs | Loki (JSON structured) |
| Traces | OpenTelemetry → Tempo (Phase 2 ops) |
| Errors | Sentry |

**Required log fields:** `trace_id`, `tenant_id`, `user_id`, `route`, `duration_ms`.

---

## 16. Disaster Recovery

- RDS automated backups 7 days, PITR  
- S3 versioning on tenant buckets  
- RTO 4h, RPO 1h (MVP targets)  

---

## 17. Enterprise & White Label Platform (Phase 9)

A self-contained `SettingsModule` plus a `PublicAnalyticsModule` add the enterprise
layer without violating module boundaries (controller → service → repository, every
query scoped by `tenant_id`).

**Data model (3 tables):**

| Table | Shape | Purpose |
|-------|-------|---------|
| `tenant_settings` | one row per `(tenant_id, category)` with a `data` JSONB column | Branding/SEO/website/features/configuration/white_label. JSONB keeps the schema flexible while defaults live in code (`settings.constants.ts`) and are deep-merged on read. |
| `custom_domains` | `domain` (unique), `is_primary`, `ssl_status`, `verification_status`, `verification_token`, `dns_records` JSONB | Vanity + subdomain mapping with DNS-based ownership proof. |
| `public_analytics_events` | append-only event rows, `ip_hash` (never raw IP), composite indexes on `(tenant_id, event_type, created_at)` | Privacy-preserving public website analytics. |

**Resolution & caching:** `FeatureFlagsService` and `TenantConfigService` are the
single source of truth — flags/config are always resolved from the DB (no hard-coded
flags) and merged over defaults. Reads pass through a Redis-shaped TTL cache
(`SettingsCacheService`, `PublicAnalyticsCacheService`); writes invalidate the
tenant's keys. The interface (`wrap()` / `invalidate()`) is swappable to Redis with
no call-site changes.

**Settings categories** are stored generically (one upsert path, one audit path) so
adding a category is config-only. Each category maps to a write permission
(`CATEGORY_WRITE_PERMISSION`) enforced at the controller via `@RequirePermissions`.

**Domain verification** issues a per-domain TXT token and CNAME route record. `verify`
performs a DNS TXT lookup (simulated in dev) and flips `verification_status`. Real
ACME/SSL issuance and host→tenant routing middleware are future seams, not yet wired.

**Public surfaces** (`/public/settings`, `/public/analytics/track`) are unauthenticated,
resolve the tenant by slug, and never trust a client-supplied `tenant_id`. Tracking
hashes the IP and silently no-ops for unknown tenants to avoid enumeration.

**Audit:** every settings/domain mutation writes an audit entry (actor, before/after,
IP, user agent). Advanced filtering + RFC 4180 CSV export (`/audit-logs/export`) extend
the existing audit module.

**Future extraction:** the analytics ingest path is a natural candidate for the outbox
+ async worker pattern (Section 14) once event volume warrants it.

---

---

## 18. AI Agent Platform (Phase 10)

The `modules/ai` bounded context adds voice + chat agents, lead qualification,
property matching, follow-up automation, conversation intelligence, and a vector
knowledge layer. It follows the standard Controller → Service → Repository
layering and scopes every query by `tenant_id`.

**Provider abstraction (no vendor lock-in):** four interfaces — `LLMProvider`,
`EmbeddingProvider`, `TranscriptionProvider`, `VoiceProvider` — resolved per
tenant by `AiProviderFactory`. Default `MockProvider` runs offline (deterministic
128-dim feature-hashing embeddings); `OpenAIProvider` is the first real bundle;
Claude/Gemini/DeepSeek slot in without engine/schema changes.

**CRM-enhancing, not replacing:** qualification writes `lead_score` +
`temperature` back to the inquiry via `CrmService.applyAiQualification` (note +
history + audit). Chat escalates to a human on handoff keywords. Voice calls
require recorded consent.

**Metering:** every model call writes an `ai_usage_events` row (feature,
provider, model, tokens); `AiAnalyticsService` derives cost-per-lead and funnel
rates. Plan limits gate `max_ai_minutes_monthly` + the `ai` feature flag.

Full detail: [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

---

*Implementation contracts: [DB_SCHEMA.md](./DB_SCHEMA.md), [API_SPEC.md](./API_SPEC.md), [DEPLOYMENT.md](./DEPLOYMENT.md).*
