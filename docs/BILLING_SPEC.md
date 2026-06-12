# RE-OS Billing & Subscription Specification

**Payment Provider:** Razorpay  
**Currency:** INR  
**Version:** 1.0

---

## 1. Plans

| Code | Name | Monthly (INR) | Yearly (INR) | Properties | Employees | Storage | AI min/mo |
|------|------|---------------|--------------|------------|-----------|---------|-----------|
| `starter` | Starter | ₹4,999 | ₹49,990 | 100 | 5 | 5GB | 0 |
| `pro` | Pro | ₹14,999 | ₹1,49,990 | 1000 | 25 | 50GB | 0 |
| `enterprise` | Enterprise | Custom | Custom | Unlimited* | Unlimited* | Unlimited* | Custom |

*Fair use policy applies.

---

## 2. Subscription Lifecycle

```
trial (14d) → active → past_due → suspended → cancelled
                    ↘ upgraded/downgraded
```

| State | Tenant behavior |
|-------|-----------------|
| trial | Full features per selected tier |
| active | Normal |
| past_due | Warning banner; 7-day grace |
| suspended | Read-only (BR-T02) |
| cancelled | Export window 30 days; then archive |

---

## 3. Razorpay Integration

### 3.1 Checkout Flow

1. Org Owner selects plan on `/settings/billing`  
2. `POST /billing/subscribe` creates provider subscription checkout  
3. Client completes payment on Razorpay hosted page  
4. Webhook `subscription.activated` → activate tenant  

### 3.2 Webhooks (Verify HMAC)

| Event | Action |
|-------|--------|
| `subscription.activated` / `subscription.renewed` | Set status active, set period dates |
| `subscription.charged` / `payment.captured` | Create invoice, payment, mark paid |
| `payment.failed` | Set past_due, record payment attempt, notify owner/admin |
| `subscription.cancelled` | Cancel subscription and organization billing status |

**Idempotency:** Store `provider_event_id` in `billing_webhook_events` table; skip duplicates.

---

## 4. Usage Enforcement

On create operations:

```typescript
if (usage.properties_count >= plan.max_properties) throw QuotaExceededException;
```

Plan limits come from active `subscription_plans`. Current implementation reads the DB directly; Redis `tenant:{id}:limits` cache remains the Phase 7+ optimization seam.

---

## 5. Invoices

- GST line item 18% (configurable per org GSTIN Phase 9)  
- PDF template: logo, line items, Razorpay payment ref  
- Stored S3 `tenants/{id}/invoices/{id}.pdf`  
- Email to `billing_email` on payment success  

---

## 5.1 Implemented APIs (Phase 7)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/billing/plans` | Active plan comparison |
| GET | `/billing/subscription` | Current tenant subscription |
| POST | `/billing/subscribe` | Create checkout/subscription |
| POST | `/billing/change-plan` | Immediate plan change |
| POST | `/billing/cancel` | Cancel now or at period end |
| GET | `/billing/invoices` | Tenant invoices |
| GET | `/billing/usage` | Usage vs plan limits |
| POST | `/billing/webhooks/razorpay` | HMAC-verified idempotent webhook |
| GET | `/platform/billing/metrics` | Super Admin revenue metrics |

---

## 6. Proration

- **Upgrade:** immediate; charge prorated difference  
- **Downgrade:** effective end of current period  

---

## 7. CEO Metrics

| Metric | Target |
|--------|--------|
| Trial → paid conversion | 25% |
| Net revenue retention | >100% annually |
| ARPA (Pro) | ₹20k/month |

---

*Business rules: [BUSINESS_RULES.md](./BUSINESS_RULES.md) BR-B*. API: [API_SPEC.md](./API_SPEC.md).*
