# Billing System — Agent Skill

## Domain Knowledge

RE-OS monetizes via Razorpay subscriptions (INR). Plans limit properties, employees, AI minutes. Billing state drives tenant suspension.

**Plans:** basic ₹4,999/mo, pro ₹19,999/mo, enterprise custom

## Business Workflow

1. Org Owner selects plan → Razorpay checkout
2. Webhook subscription.activated → active subscription row
3. Usage enforced on create endpoints via quota service
4. Renewal charged → invoice row + PDF job + email
5. payment.failed → past_due → day 7 suspend org
6. Cancel → access until period end

## Entity Relationships

```
subscription_plans 1──* subscriptions
subscriptions 1──* invoices
invoices 1──* payment_transactions
organizations.tier denormalized from active subscription
organization_usage compared against plan limits
```

## Validation Rules

- BR-B01 downgrade at period end; upgrade immediate
- BR-B02 past_due 7d → suspend
- BR-B03 webhook idempotency
- BR-B04 invoice PDF async

## Common Edge Cases

- Webhook arrives before checkout redirect → poll subscription status
- Duplicate webhook → idempotent skip
- Upgrade mid-cycle with failed payment → stay on old plan
- Trial expired without payment → auto suspend

## API Considerations

- `POST /billing/webhooks/razorpay` no JWT; HMAC only
- `GET /billing/subscription` owner/admin only
- Return upgrade URL in QUOTA_EXCEEDED errors

## Database Considerations

- Store amounts in paise (integer) in invoices/transactions
- razorpay_subscription_id unique
- webhook_events table for idempotency (add in Phase 7 migration)
