# CRM Management — Agent Skill

## Domain Knowledge

CRM centers on **inquiries** (leads) moving through **pipeline stages** from capture to Closed Won/Lost. Activities and follow-ups provide timeline and SLA discipline.

**Default stages:** New → Contacted → Qualified → Matched → Visit Scheduled → Visit Done → Negotiation → Won/Lost

## Business Workflow

1. Lead arrives: public form, manual entry, AI call, or chat
2. Duplicate check on phone (30-day window)
3. Assignment: manual, round-robin, or self-claim (config)
4. Agent contacts → logs activity → schedules follow-up
5. Link matching properties → schedule site visit
6. Negotiation → Closed Won (commission tracking Phase 4+) or Lost with reason

## Entity Relationships

```
pipeline_stages 1──* inquiries
inquiries *──* properties (inquiry_properties)
inquiries 1──* inquiry_activities
inquiries 1──* follow_ups
inquiries 1──* ai_calls (optional)
employees 1──* inquiries (assigned)
```

## Validation Rules

- BR-C01 duplicate phone warning
- BR-C02 stage order (manager can jump)
- BR-C03 Won needs property or reason
- BR-C04 Lost needs lost_reason
- BR-C08 budget_max >= budget_min

## Common Edge Cases

- Concurrent stage updates → optimistic locking or last-write with activity log
- Reopening closed inquiry on new client message
- Manager reassigning while executive editing → notify both
- Public inquiry without property_slug → general requirement only

## API Considerations

- `GET /inquiries/kanban` returns stages with cards array
- Scope filters mandatory in service layer per role
- `POST /inquiries/:id/activities` append-only
- Public `POST /public/{slug}/inquiries` rate limited

## Database Considerations

- Index `(tenant_id, client_phone)`, `(tenant_id, stage_id)`, `(tenant_id, assigned_employee_id)`
- inquiry_number human-readable per tenant (sequence or prefix)
- follow_ups index on due_at for scheduler job
