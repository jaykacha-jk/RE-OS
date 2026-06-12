# Notification System — Agent Skill

## Domain Knowledge

Notifications deliver timely alerts via in-app, email (SES), and WhatsApp (BSP). Templates customizable per tenant; preferences for non-transactional channels.

**Types:** new_inquiry, follow_up_due, assignment, property_match, billing

## Business Workflow

1. Domain event triggers NotificationService
2. Resolve template (tenant override or platform default)
3. Check user preferences (transactional always send BR-N01)
4. Enqueue channel jobs: in_app, email, whatsapp
5. In-app persisted + Socket.io push
6. Delivery status tracked in notification_deliveries

## Entity Relationships

```
notification_templates (tenant_id nullable)
notifications (in-app per user)
notification_deliveries (outbound tracking)
Triggered by: inquiries, follow_ups, billing, assignments
```

## Validation Rules

- BR-N01 transactional cannot be disabled
- BR-N03 follow-up reminders T-1h and T=0
- WhatsApp requires approved template per BSP

## Common Edge Cases

- User has no email → in-app only + log warning
- SES bounce → mark email undeliverable on user
- Burst of 100 inquiries → batch digest option (Phase 5+)
- Tenant suspended → still send billing emails to owner

## API Considerations

- `GET /notifications` paginated, user scoped
- `PATCH /notifications/:id/read`
- Preferences PATCH non-transactional toggles only

## Database Considerations

- Index notifications (user_id, read_at, created_at DESC)
- TTL archive read notifications >90 days optional job
- Template code unique per tenant+channel
