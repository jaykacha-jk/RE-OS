# RE-OS — Product Audit Report

**Stance:** Product Manager + Staff Backend Engineer + Senior Frontend Engineer.
**Date:** 2026-06-12
**Method:** Verified against code. Every "real / stub / missing" call has a file-path basis.

Legend: ✅ Real & functional · 🟡 Partial / placeholder · 🔶 Stub/mock (looks done, isn't wired) · ❌ Missing

---

## 1. Module-by-Module Truth Table (Backend)

| Module | State | Evidence / Notes |
|---|:--:|---|
| Auth | ✅ | RS256 15-min access tokens, hashed+rotated refresh, bcrypt cost 12, lockout (5/15min), reset tokens. `modules/auth/auth.service.ts`. |
| Auth — refresh reuse detection | ✅ | Refresh tokens carry `token_family_id`; reuse of a revoked token revokes the active family and audits `auth.refresh.reuse_detected`. |
| Auth — email verification | 🟡 | Only implicit via invite acceptance (`email_verified_at` set). No standalone verify flow. |
| RBAC | ✅ | DB-driven roles/permissions; `PermissionsGuard` + `@RequirePermissions`. Guard is **per-controller**, not global. `rbac.module.ts` is an empty shell. |
| Tenant isolation | ✅/🟡 | `tenant_id` from JWT `tid` (not client body — good). Repos scope by `tenant_id`; `TenantScopedRepository` now appends/asserts tenant filters for high-risk repository paths. Postgres RLS/live-DB e2e remain hardening work. |
| Properties | ✅ | Full CRUD, media, assignment, quota, history, public DTO. `modules/properties`. |
| CRM / Inquiries | ✅ | Pipeline, stage rules (BR-C02/03/04), duplicate detection, notes/followups/site-visits, lead sources, metrics. `modules/crm`. |
| Analytics | ✅ | Aggregations, funnel, sources, monthly trends (parameterized SQL), TTL cache, platform metrics. |
| Employees | ✅/🟡 | CRUD + invite + quota. Pro quota mapping fixed; employee role DTOs now match the six seeded roles. |
| Settings (branding/seo/website/features/config/white-label) | ✅ | One row per category, deepMerge, feature flags, tenant config. |
| Custom domains | 🟡 | Add/verify/delete real; DNS verify is **simulated**, no ACME/SSL or host→tenant routing. |
| Platform (Super Admin orgs) | ✅ | Org CRUD + owner invitation record. |
| Audit | ✅ | Writes on auth/CRUD/billing/settings; list + CSV export. |
| Public analytics | ✅ | Anonymous ingest (IP hashing), dashboard. Trusts `tenant` slug from body (acceptable for public, needs abuse controls). |
| Notifications — in-app + realtime | ✅ | Persist + Socket.IO `/notifications`, BullMQ (Redis) or in-memory fallback. |
| Notifications — email delivery | 🔶 | `production-email-provider.ts` **throws**; dev = console log. No ESP. |
| Notifications — push/WhatsApp | ❌ | None. |
| Billing — data model + webhook | ✅ | Plans/subs/invoices/usage; webhook **HMAC verify + idempotency** real. |
| Billing — payment provider | 🔶 | Default `mock`; `RazorpayProvider` fabricates `rzp_sub_…` locally. No live charge. Invoice PDF deferred. |
| Chat | ✅ | Socket.IO `/chat`, tenant-scoped conversation access, persistence, assignment, CRM convert. |
| Chat — public widget / WhatsApp | 🟡/❌ | Token helpers exist; no embed UI. WhatsApp is a deep link only. |
| AI chat (RAG) | ✅/🔶 | Real OpenAI path + embedding KB search **when key present**; otherwise mock. Default factory = mock. |
| AI lead qualification / matching / intelligence | 🟡 | **Rule-based engines**, not LLM — despite "AI" branding. |
| AI voice agent | 🔶 | Pipeline persists calls/transcripts, but **telephony is mock-only** (`mock_call_…`, `mock://recordings/…`). No Twilio/Exotel. |
| AI follow-up automation | 🟡 | Rule-based stale-lead scan, not AI-generated. |
| `tenant`, `users`, `rbac` modules | ❌ | Empty `@Module({})` shells (functionality lives in common/seed). |
| `search` module | ❌ | Not present despite docs reference. |

**Prisma:** 61 models, 11 migrations — schema is genuinely comprehensive.

---

## 2. Frontend Truth Table

| Area | State | Notes |
|---|:--:|---|
| Admin shell + role-aware nav | ✅ | `components/admin/nav-config.ts`, `admin-shell.tsx`. Command palette (Cmd/K), notification bell, quick "Add property". |
| Auth pages (login/forgot/reset/accept-invite) | ✅/🟡 | API-wired; forgot-password UI itself admits email is a "Phase 1 stub"; dev creds embedded for non-prod. |
| **Signup / registration** | ❌ | **No route exists.** "Get Started" → `/login`. |
| Dashboard, Analytics, Performance | ✅ | Real API calls. |
| Properties, Inquiries, Pipeline, Lead sources | ✅ | Full CRUD wired. |
| Chat, Notifications | ✅ | API + sockets. |
| Billing (plans/subscription/usage/invoices) | ✅ | Wired to (stub) billing backend. |
| AI pages (dashboard/calls/knowledge/prompts/followups/playground/settings) | ✅/🔶 | Wired to `lib/ai.ts`; settings exposes `mock` provider explicitly. |
| Settings sub-pages | ✅/🟡 | All wired; Profile supports editing first name, last name, and phone. |
| Public site (home/listings/detail/SEO/contact/chat) | ✅/🟡 | Listings + detail + inquiry form real; trust content is tenant-driven; first-party public chat widget shipped. Maps are placeholders; newsletter is local-only. |
| Component library `components/ui` | 🟡 | Only `icons.tsx` — not a real design system; many page-local forms/tables. |

---

## 3. Overbuilt vs Underbuilt

**Overbuilt (ahead of where a pre-revenue product needs to be):**
- Full **AI Agent Platform** scaffold (voice, RAG, intelligence, prompts, knowledge base, 7 UI pages) — but on mock providers and with no paying customer to use it.
- White-label, custom domains, public-analytics — Phase 9 enterprise features before Phase 0 (signup) exists.

**Underbuilt (blocks revenue/daily use):**
- Self-serve **signup + onboarding** (❌).
- **Email/ESP** delivery (🔶) — without it, invites, password resets, and billing emails are dead.
- **Live payments** (🔶).
- Reassign-on-employee-delete (deferred), buyer accounts/saved properties, production follow-up channels.

---

## 4. Product Scores

| Dimension | Score | Rationale |
|---|:---:|---|
| Core CRM completeness | 8/10 | Pipeline, rules, follow-ups, site visits, metrics all real. |
| Property domain | 8/10 | Robust, SEO-ready, quota-aware. |
| Monetization readiness | 3/10 | Webhook real, charging fake, no signup. |
| AI value delivery | 4/10 | Architecture strong; runtime mostly mock/rule-based vs marketing. |
| Public/buyer funnel | 6/10 | Functional listings + inquiry; trust content driven by tenant website settings. |
| Internal consistency (docs↔code) | 4/10 | Several overclaims; status doc self-contradicts. |
| **Product overall** | **5.5/10** | Strong skeleton, missing the revenue muscles. |

---

## 5. Top Product Risks (engineering)

1. **Mock-by-default AI/payment providers** can ship to prod silently and "work" with fake data.
2. 🟡 **Tenant isolation is still app-layer** — base repository guards reduce missed-filter risk, but Postgres RLS and live-DB e2e are still needed for stronger defense.
3. ✅ **Refresh-token reuse detection implemented** — token-family revocation + audit on revoked-token reuse.
4. **Email provider throws in prod** — every transactional flow (invite/reset/billing) breaks the moment `EMAIL_PROVIDER=production`.
5. **Empty `tenant`/`users`/`rbac` modules + missing `search`** — drift between architecture intent and code.
6. ✅ **`pro → growth` plan mapping bug fixed** — Pro employee quota now resolves to the seeded Pro plan.

See remediation in `docs/FINAL_RECOMMENDATIONS.md`.
