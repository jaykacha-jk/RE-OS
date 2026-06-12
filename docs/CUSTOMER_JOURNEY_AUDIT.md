# RE-OS — Customer Journey Audit

**Date:** 2026-06-12
**Method:** Simulated each persona against actual routes/endpoints. Two journeys: the **buyer** (public site) and the **sales team** (admin app).

---

## Journey A — Property Buyer (Public Website)

**Path:** Website → search → property detail → inquiry/contact → follow-up.

| Step | Works? | Evidence / Gap |
|---|:--:|---|
| Land on tenant homepage | ✅ | `frontend/app/(public)` hero + featured listings (`lib/public-site.ts`). |
| Browse listings + filter | ✅ | `/listings?tenant=…` → `GET /api/v1/public/properties`. |
| SEO landing (`/buy/{city}/{slug}`) | ✅ | Real metadata, canonical, `RealEstateListing` JSON-LD, sitemap/robots. |
| Property detail (photos, price, specs) | ✅ | `GET /api/v1/public/properties/{slug}`. |
| Submit inquiry | ✅ | Form → `POST /api/v1/public/{tenant}/inquiries` → creates CRM lead (`source = Website`). |
| Contact page | ✅ | Same public inquiry endpoint. |
| WhatsApp the agent | 🟡 | Deep link only, hardcoded "RE-OS Sales Team" agent identity. |
| Live chat with agency | ✅ | Floating public widget starts website conversations with HMAC visitor tokens and REST polling. |
| Buyer account / saved properties / profile | ❌ | No `client` role, no `/saved`, no `/profile`. |
| Trust signals (reviews, real offices, team, stats) | 🟡 | **Hardcoded/placeholder** testimonials, stats, offices; map previews are placeholders. |
| EMI calculator | ❌ | Not built. |
| Newsletter | 🔶 | Local-only form, not wired to backend. |

### Is the website trustworthy? Would a buyer convert?
**Improving.** The core conversion mechanics (search → detail → inquiry) are **real and SEO-strong**, public trust content now comes from tenant settings, and live chat is first-party. Remaining trust gaps are buyer accounts/saved properties, map fidelity, and production follow-up channels. Conversion-ready at ~**7/10**.

---

## Journey B — Sales Team (Admin App)

### Sales Executive (daily driver)
| Task | Works? | Notes |
|---|:--:|---|
| See my assigned leads | ✅ | `assigned` scope enforced in `crm.service.ts`. |
| Create/update inquiry, add notes | ✅ | Full CRM. |
| Schedule follow-ups & site visits | ✅ | With statuses + reminders (Phase 5 automation). |
| Get reminded (in-app/realtime) | ✅ | Socket.IO `/notifications`. |
| Get reminded (email) | 🔶 | ESP not wired → email reminders don't send. |
| Chat with leads | ✅ | App-native chat; assigned scope. |
| Update pipeline stage | ✅ | Kanban + stage rules. |

### Sales Manager
| Task | Works? | Notes |
|---|:--:|---|
| Assign leads / properties | ✅ | Assignment endpoints. |
| Team analytics / leaderboard | ✅ | `/performance`, `/analytics`. |
| View employees | 🟡 | Nav shows `/employees` but manager lacks `employees.read` → friction. |
| Manage lead sources | ❌ | Not granted to manager (owner/admin only). |

### Telecaller
| Task | Works? | Notes |
|---|:--:|---|
| View assigned leads, log calls/notes/followups | ✅ | Scoped correctly. |
| Create/update inquiries | ❌ | **Not permitted** (stricter than docs). May be intentional, but limits a calling-first workflow. |
| See properties to pitch | ❌ | No property permission — telecaller can't view inventory while on a call. **Real workflow friction.** |

### Owner / Admin
| Task | Works? | Notes |
|---|:--:|---|
| Manage employees, properties, settings, website, branding | ✅ | Full settings suite. |
| Track sales & revenue | ✅ | Analytics + platform metrics. |
| Manage billing | 🔶 | UI real; charges via mock/stub provider. |
| Invite employees | 🔶 | Token created; email can't deliver in prod. |

---

## Friction Summary

| # | Friction point | Persona | Severity |
|---|---|---|---|
| 1 | No email delivery (reminders, invites, resets) | All | High |
| 2 | Telecaller can't view properties or create inquiries | Telecaller | High |
| 3 | Manager sees `/employees` but is denied | Manager | Medium |
| 4 | No public chat / buyer account / saved listings | Buyer | Medium |
| 5 | ✅ Public trust content (testimonials/stats/contact) driven by tenant settings | Buyer | Low |
| 6 | Billing charges are mock | Owner | High |
| 7 | ✅ Profile is editable for basic account details | All | Low |

---

## Customer Journey Scores

| Journey | Score | Note |
|---|:---:|---|
| Buyer / public funnel | 6/10 | Real search+inquiry+SEO; placeholder trust + no chat/account. |
| Sales Executive daily | 8/10 | Genuinely usable CRM once seeded. |
| Sales Manager | 7/10 | Strong analytics; small permission/nav snags. |
| Telecaller | 5/10 | Over-restricted for a calling role. |
| Owner / Admin | 7/10 | Powerful, but blocked by email + mock billing. |
| **Overall journey** | **6.5/10** | The *inside* of the product is good; the *edges* (signup, email, payments, buyer-side) are weak. |
