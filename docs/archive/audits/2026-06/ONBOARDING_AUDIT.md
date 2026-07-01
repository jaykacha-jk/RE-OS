# RE-OS — Onboarding & Registration Audit

**Stance:** CEO + Agency Owner attempting to become a customer with no developer help.
**Date:** 2026-06-12
**Method:** Traced the full path through `backend/src/modules/auth`, `modules/platform`, `modules/employees`, `frontend/app/(auth)`, `frontend/app/(dashboard)/platform/organizations`, and `backend/prisma/seed.js`.

---

## Definitive Answer

> **Can a new agency register and start using RE-OS today, without a developer?**
> # NO.

There is **no public signup endpoint** and **no signup page**. New organizations exist only via **Super Admin creation** or **DB seed**. Owner/employee invitations generate tokens but rely on email, and the **production email provider throws** — so even the manual path can't deliver an invite link in production.

---

## 1. Documented vs Actual Flow

**Documented (the brief & docs):**
```
Website → Registration → Email Verification → Org Creation → Subscription → Dashboard
```

**Actual:**
```
Super Admin (you) → POST /platform/organizations → owner invitation token (dev hint only)
        → manually deliver token → owner sets password via /accept-invitation → Dashboard
        → (billing is selectable but charges via mock provider)
```

| Step | Documented | Implemented | Evidence |
|---|:--:|:--:|---|
| Public marketing → "Get Started" | ✅ | 🟡 | Button links to `/login`, not signup (`components/public/public-header.tsx`). |
| Self-serve **Registration** | ✅ | ❌ | No `register`/`signup` route; no public auth endpoint. |
| **Email verification** | ✅ | ❌ | No standalone verify flow; `email_verified_at` only set on invite acceptance. |
| **Organization creation** | ✅ (self-serve) | 🔶 | Exists only inside **Super Admin** area (`platform/organizations/create-org-form.tsx`). |
| **Subscription / checkout** | ✅ | 🔶 | Plan selection UI exists post-login; charge uses **mock/stub Razorpay**. |
| **Dashboard** | ✅ | ✅ | Real, once a session exists. |

---

## 2. What Actually Exists

- **Login** (`/login`) — real, RS256, optional `tenant_slug`. ✅
- **Forgot/Reset password** — endpoints real; **email not sent** (UI says "Phase 1 stub"). 🟡
- **Accept invitation** (`/accept-invitation`) — real; sets password, issues tokens. ✅
- **Super Admin org creation** — real; returns an owner invitation **dev token hint** (suppressed in prod). 🔶
- **Seed** — creates Super Admin, demo org, demo owner + sales exec. (Dev only.) ✅

## 3. What's Missing (the onboarding gap)

1. Public **`POST /auth/register`** (or `/signup`) that creates org + owner + trial in one transaction.
2. Frontend **`/signup`** page (agency name, owner email, plan, password) + **email verification**.
3. **ESP integration** so the verification/invite/reset emails actually send (`production-email-provider.ts` currently throws).
4. **Self-serve plan selection during signup** with a **real Razorpay** subscription + trial.
5. Employee invite that **emails a working accept link** (today `invitation_sent: false`; frontend even discards the returned dev `accept_url`).
6. An **empty-state activation checklist** that survives a real (non-seeded) tenant — the dashboard checklist exists but assumes you got in.

---

## 4. Employee Invitation Sub-Flow

| Aspect | State | Evidence |
|---|:--:|---|
| Create invited user + role + employee row + token | ✅ | `modules/employees/employees.service.ts` |
| Accept page + set password | ✅ | `/accept-invitation` |
| Email delivery of invite | ❌ | dev = console log; prod provider throws; default template lacks accept link |
| API surfaces invite link to admin | ❌ | response `invitation_sent: false`; dev `accept_url` returned but **frontend ignores it** |

**Net:** structurally complete, operationally dead without an ESP or a "copy invite link" UI.

---

## 5. Onboarding Scores

| Aspect | Score | Note |
|---|:---:|---|
| Self-serve readiness | 1/10 | No signup at all. |
| Manual provisioning | 5/10 | Works for a hands-on operator, blocked by email in prod. |
| Activation UX (post-login) | 6/10 | Dashboard empty-state/checklist is thoughtful. |
| Email/communications | 2/10 | No ESP; resets/invites can't be delivered. |
| **Onboarding overall** | **3/10** | The #1 thing standing between RE-OS and being a SaaS. |

---

## 6. Minimum Path to "An Agency Can Start Alone"

1. Wire **one ESP** (Resend/SES/SendGrid) behind the existing `EmailProvider` interface — unblocks *everything*.
2. Add **`/signup` + `POST /auth/register`**: create org (status `trial`), owner user, default roles/lead-sources, usage row; send verification email.
3. Add **plan pick + live Razorpay** subscription (or "start free trial, add card later").
4. Add **"Copy invite link"** fallback in the employee form for when email is delayed.
5. End-to-end test: stranger → signup → verify → dashboard → invite teammate → add property — **with zero developer involvement.**

This is the single highest-ROI workstream in the repo. See `docs/FINAL_RECOMMENDATIONS.md`.
