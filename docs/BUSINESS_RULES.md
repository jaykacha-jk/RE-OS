# RE-OS Business Rules

**Version:** 1.0  
**Last Updated:** 2026-06-05

Domain invariants enforced in service layer — never only in UI.

---

## 1. Tenant & Organization

| ID | Rule |
|----|------|
| BR-T01 | Organization `slug` is immutable after creation (SEO/subdomain stability). |
| BR-T02 | Suspending org sets read-only mode: no creates; updates to close inquiries allowed. |
| BR-T03 | Trial org expires after 14 days unless subscription active. |
| BR-T04 | Usage limits enforced on create: properties, employees, AI minutes. |
| BR-T05 | Deleting org requires Super Admin + export window; soft-delete with 90-day retention. |

---

## 2. Authentication & Users

| ID | Rule |
|----|------|
| BR-A01 | Email unique per tenant; platform super admin emails globally unique. |
| BR-A02 | Password: min 8 chars, 1 uppercase, 1 lowercase, 1 digit. |
| BR-A03 | Failed login lockout: 5 attempts / 15 min / account. |
| BR-A04 | Refresh token rotation: old token revoked on refresh. |
| BR-A05 | Invited user must accept within 7 days or invitation expires. |
| BR-A06 | Client users cannot access internal API routes. |

---

## 3. Employees

| ID | Rule |
|----|------|
| BR-E01 | Employee must link to exactly one user per tenant. |
| BR-E02 | Cannot delete employee with open inquiries unless reassigned (422). |
| BR-E03 | Manager cannot be own manager (cycle detection). |
| BR-E04 | At least one `org_owner` or `org_admin` must remain active per tenant. |
| BR-E05 | Telecaller cannot delete properties or employees. |

---

## 4. Properties

| ID | Rule |
|----|------|
| BR-P01 | `slug` auto-generated from title; unique per tenant; manual override by admin only once. |
| BR-P02 | Public listing requires `status = available` AND `is_public = true` AND ≥1 image. |
| BR-P03 | Sold/Rented properties auto-removed from public search index within 60s. |
| BR-P04 | Price cannot be negative; `on_request` allows null price with flag. |
| BR-P05 | Bulk import max 500 rows per job; invalid rows reported without partial silent fail. |
| BR-P06 | Primary assigned agent max 1 per property. |
| BR-P07 | Archived properties cannot receive new inquiries. |

---

## 5. Inquiries & CRM

| ID | Rule |
|----|------|
| BR-C01 | Duplicate detection: same `client_phone` + open stage within 30 days → warn, allow override with note. |
| BR-C02 | Stage transitions must follow pipeline order except manager can jump (logged). |
| BR-C03 | Closed Won requires ≥1 linked property or explicit "no property" reason. |
| BR-C04 | Closed Lost requires `lost_reason`. |
| BR-C05 | Assigning inquiry notifies assignee (in-app + email). |
| BR-C06 | Follow-up due in past → appears overdue; auto-escalate to manager after 48h overdue. |
| BR-C07 | Client-submitted inquiry auto-assigns round-robin to active sales executives if enabled in settings. |
| BR-C08 | Budget max must be ≥ budget min when both set. |

**Pipeline default order:** New → Contacted → Qualified → Matched → Visit Scheduled → Visit Done → Negotiation → Won/Lost

---

## 6. AI Calling

| ID | Rule |
|----|------|
| BR-AI01 | Outbound call requires `consent_recorded = true` OR inquiry opt-in flag. |
| BR-AI02 | AI minutes deducted on call connect; failed calls <10s not billed. |
| BR-AI03 | Transcript stored only after call completed. |
| BR-AI04 | Auto-update inquiry fields only when confidence score ≥ 0.8 (configurable). |
| BR-AI05 | DND registry check before outbound (India TRAI compliance). |
| BR-AI06 | Recording retention: 90 days default; enterprise configurable. |

---

## 7. Chat

| ID | Rule |
|----|------|
| BR-CH01 | Conversation must link to tenant; client identified by session or user. |
| BR-CH02 | Unassigned conversations auto-assign after 5 min to available agent (round-robin). |
| BR-CH03 | Closed conversation reopen on new client message. |
| BR-CH04 | Agents see only assigned conversations unless manager role. |

---

## 8. Notifications

| ID | Rule |
|----|------|
| BR-N01 | Transactional notifications cannot be disabled by user. |
| BR-N02 | WhatsApp requires verified business number per tenant (Phase 5+). |
| BR-N03 | Follow-up reminders sent at T-1h and T=0 unless completed. |

---

## 9. Billing

| ID | Rule |
|----|------|
| BR-B01 | Downgrade applies at period end; upgrade immediate with proration. |
| BR-B02 | Past due > 7 days → org suspended (BR-T02). |
| BR-B03 | Razorpay webhook idempotency by `event_id`. |
| BR-B04 | Invoice PDF generated async; available within 5 min. |

See [BILLING_SPEC.md](./BILLING_SPEC.md).

---

## 10. Audit & Compliance

| ID | Rule |
|----|------|
| BR-AU01 | All create/update/delete on properties, inquiries, employees logged. |
| BR-AU02 | Audit logs immutable. |
| BR-AU03 | PII export/deletion requests fulfilled within 30 days (GDPR-ready). |

---

## 11. SEO & Public Content

| ID | Rule |
|----|------|
| BR-S01 | Programmatic city pages require ≥5 public listings to index (`is_indexable`). |
| BR-S02 | Canonical URL always HTTPS tenant domain. |
| BR-S03 | Noindex on draft and sold listings. |

---

## 12. Validation Summary Tables

### Phone (India-first)

- Format: E.164 `+91XXXXXXXXXX`  
- Normalize on input strip spaces/dashes  

### Currency

- INR only MVP  
- Store amounts in paise (integer) in billing; decimal in property/inquiry  

### Text Limits

| Field | Max |
|-------|-----|
| Inquiry notes | 5000 |
| Property title | 200 |
| Chat message | 4000 |
| Activity content | 5000 |

---

*Enforcement: unit tests per rule ID in respective modules.*
