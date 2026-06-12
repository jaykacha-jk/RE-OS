# Dashboard — Agent Skill

## Domain Knowledge

Dashboard provides role-filtered KPIs and charts for operational visibility. Data sourced from OLTP queries (today) and `analytics_daily_snapshots` (historical).

## Business Workflow

1. User logs in → lands on dashboard per role
2. Widgets load from `/dashboard/summary` with cached aggregates
3. Manager drills into reports module for exports
4. Nightly job refreshes daily snapshots per tenant

## Entity Relationships

```
analytics_daily_snapshots (tenant_id, date, metrics JSONB)
Reads from: inquiries, properties, employees, subscriptions
No separate dashboard tables beyond snapshots
```

## Validation Rules

- KPI visibility per RBAC UI matrix
- Sales executive sees assigned metrics only
- Client dashboard: saved properties, inquiry status only

## Common Edge Cases

- Empty tenant → guided empty states not zeros without context
- Timezone: org timezone for "today" boundaries
- Large tenant slow queries → rely on snapshots for historical ranges

## API Considerations

- Single `/dashboard/summary` with role-based field filtering in service
- Cache response Redis 5m keyed by tenant+role
- Do not expose other agents' revenue to executives

## Database Considerations

- Snapshot job idempotent upsert on (tenant_id, snapshot_date)
- analytics_events for granular funnels optional
- Index snapshots by tenant_id + date DESC
