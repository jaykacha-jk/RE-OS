# Analytics — Agent Skill

## Domain Knowledge

Analytics captures product usage and business outcomes for internal dashboards and future benchmarking. Event-based ingestion with daily rollups.

**Key events:** inquiry.created, inquiry.stage_changed, property.published, call.completed, subscription.changed

## Business Workflow

1. Domain services emit analytics_events (async queue)
2. Worker inserts into analytics_events table
3. Nightly rollup → analytics_daily_snapshots metrics JSON
4. Reports module queries snapshots + live for "today"
5. Super Admin cross-tenant aggregates anonymized platform-wide

## Entity Relationships

```
analytics_events (high volume, partitioned)
analytics_daily_snapshots 1 per tenant per day
Derived from all core modules
```

## Validation Rules

- Events must include tenant_id
- No PII in event properties without hashing policy
- Super Admin platform metrics never expose tenant-identifiable client phones in aggregate exports

## Common Edge Cases

- Event duplication → idempotency key event_id
- Backfill after outage → batch recompute snapshots
- GDPR delete user → anonymize actor_id in events

## API Considerations

- `GET /reports/inquiries?from&to&format=csv` async for large exports
- Rate limit exports 5/hour/tenant
- Dashboard reads snapshots; reports may hit OLTP for small ranges

## Database Considerations

- Partition analytics_events monthly
- Retain raw events 90 days; snapshots 2 years
- GIN on properties JSONB metrics optional
