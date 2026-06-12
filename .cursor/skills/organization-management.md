# Organization Management — Agent Skill

## Domain Knowledge

Organizations are tenants in RE-OS. Each org has a unique `slug` (subdomain), subscription tier, usage quotas, and isolated data. Super Admin manages orgs platform-wide; Org Owner manages settings within tenant.

**Key entities:** `organizations`, `organization_usage`, `subscriptions`

**Tiers:** basic (50 properties, 5 employees), pro (500/25), enterprise (custom)

**Statuses:** trial (14d), active, suspended (read-only), cancelled

## Business Workflow

1. Super Admin creates org with name, slug, tier, billing_email, owner_email
2. System seeds default roles, pipeline stages, notification templates
3. Invitation sent to owner → accept → set password
4. Owner completes activation: add employees + properties
5. Subscription webhook activates paid tier or trial expires → suspend

## Entity Relationships

```
organizations 1──1 organization_usage
organizations 1──* subscriptions
organizations 1──* users (tenant_id)
organizations 1──* employees (via users)
```

## Validation Rules

- BR-T01: slug immutable after create
- BR-T02: suspended = read-only (no creates)
- BR-T03: trial 14 days
- BR-T04: enforce quotas on property/employee create
- Slug: `^[a-z0-9-]{3,63}$`, unique globally

## Common Edge Cases

- Slug collision on create → 409
- Suspending org mid-checkout → complete webhook then suspend
- Downgrade when over quota → grandfather existing records; block new creates
- Owner email same as existing user in another tenant → allowed (different tenant_id)

## API Considerations

- `POST /platform/organizations` — Super Admin only
- Tenant context from JWT `tenant_id` for org settings
- Public tenant resolution: subdomain → org lookup middleware
- Never return other orgs' data in list endpoints

## Database Considerations

- `organizations` has NO tenant_id (is the tenant root)
- Soft delete org with 90-day retention BR-T05
- Cascade: do not hard-delete; soft-delete users/properties first
- Index on `slug`, `status`
