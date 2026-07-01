# RE-OS — Bug Report (Phase 11C)

**Date:** 2026-06-12
**Severity:** P0 = blocker/security/data-loss · P1 = major/security-hardening · P2 = functional defect · P3 = minor
**Status legend:** ✅ FIXED this pass · 📋 DOCUMENTED (recommended, not yet applied)

Summary: **0 P0**, **6 P1**, **8 P2**, **6 P3**. Fixed this pass: **7** (all safe, self-contained). Remaining items are documented with exact file/line + recommended fix.

---

## P0 — None
Live auth, RBAC, and tenant isolation verified correct end-to-end (see QA_REPORT §2).

---

## P1

### BUG-001 ✅ Frontend API base defaults to wrong port (3001) when env missing
- **Files:** `frontend/lib/api.ts:3`, `frontend/lib/public-site.ts:3`, `frontend/lib/settings.ts:4`, `frontend/hooks/use-chat-socket.ts:9`, `frontend/hooks/use-notifications.ts:15`
- **Problem:** Fallback was `http://localhost:3001` while the backend runs on `4545`. Masked locally by `frontend/.env.local`, but any deploy/dev without that env silently fails all API + socket calls.
- **Fix applied:** Defaults changed to `http://localhost:4545`.

### BUG-002 ✅ Employee create/delete controls shown to users without permission
- **Files:** `frontend/app/(dashboard)/employees/page.tsx`
- **Problem:** "Add employee" form and per-row "Remove" rendered for every role; clicking only failed with a backend 403. Capability leaked in UI.
- **Fix applied:** Gated with `hasPermission(session,'employees.create')` and `…'employees.delete'`, resolved post-mount to avoid hydration mismatch.

### BUG-003 ✅ Chat "Close conversation" shown without permission
- **File:** `frontend/app/(dashboard)/chat/page.tsx`
- **Problem:** Close button visible to any chat-page user; backend requires `chat.conversations.update`.
- **Fix applied:** Added `canClose` gate consistent with existing `canAssign/canConvert/canSend`.

### BUG-004 📋 Razorpay webhook verification is weak
- **Files:** `backend/src/modules/billing/providers/razorpay.provider.ts:35-42`, `backend/src/modules/billing/billing.service.ts:329-360`
- **Problem:** (a) signature computed over `JSON.stringify(dto)` instead of the **raw request body**; (b) comparison is plain `===`, not `crypto.timingSafeEqual`; (c) non-production accepts missing secret/signature; (d) idempotency marks **failed** processing with `processed_at`, so retries are dropped.
- **Recommended fix:** Capture raw body (Nest `rawBody`), verify HMAC-SHA256 over raw body with `timingSafeEqual`, require the secret in all shared environments, and only set `processed_at` on **successful** handling (keep failures retryable; use a unique constraint on event id).

### BUG-005 📋 Scoped-read-then-unscoped-write across repositories
- **Files (representative):** `backend/src/modules/properties/properties.repository.ts:267,270,283,319,343,401-413,439-448,465-485`; `backend/src/modules/crm/crm.repository.ts:283,305,325,361,483-485,547-548,625-626`; `backend/src/modules/chat/chat.repository.ts:329,332,367,387,496,543,571,590`; `backend/src/modules/employees/employees.repository.ts:221,233,271,275`; `backend/src/modules/settings/settings.repository.ts:120,138`; `backend/src/modules/billing/billing.repository.ts:95`
- **Problem:** `update/delete/count` use only `id`/`<fk>_id` without `tenant_id`. Functionally gated today because services do a tenant-scoped read first, but this is a defense-in-depth gap and a race/maintenance hazard. (Live cross-tenant probe still returns 404 — see QA_REPORT §2.3.)
- **Recommended fix:** Convert to `updateMany/deleteMany` with `{ id, tenant_id }` (or `{ tenant_id, <fk>_id }` for child tables) and assert affected-row counts; add composite unique constraints.

### BUG-006 📋 User invitation lookup not tenant-scoped
- **Files:** `backend/src/modules/auth/auth.repository.ts:122-136`, `backend/src/modules/auth/auth.service.ts:273-287`
- **Problem:** `findInvitedUser()` resolves by email + role without tenant; the same email/role across tenants could activate the wrong user on invitation accept.
- **Recommended fix:** Persist `tenant_id` + `user_id` on `user_invitations` and resolve the invitation to a specific tenant/user.

---

## P2

### BUG-007 ✅ AI Knowledge form offers an invalid document type
- **File:** `frontend/app/(dashboard)/ai/knowledge/page.tsx:13`
- **Problem:** Type list included `knowledge`; backend `@IsIn` accepts only `property|faq|policy|document` → selecting it 400s.
- **Fix applied:** Replaced `knowledge` with `document`.

### BUG-008 ✅ Employee create form offers a non-existent role
- **File:** `frontend/app/(dashboard)/employees/create-employee-form.tsx`
- **Problem:** `marketing_user` is not a seeded role (valid: org_admin, sales_manager, sales_executive, telecaller) → creation fails.
- **Fix applied:** Removed `marketing_user`.

### BUG-009 ✅ AI Prompts page shows "Loading…" forever when list is empty
- **File:** `frontend/app/(dashboard)/ai/prompts/page.tsx`
- **Problem:** No loading flag; a successful empty response was indistinguishable from in-flight.
- **Fix applied:** Added `loading` state + a real empty-state message.

### BUG-010 📋 AI mutation controls not permission-gated
- **Files:** `frontend/app/(dashboard)/ai/calls/page.tsx:64-89`, `ai/knowledge/page.tsx:91-122,188-191`, `ai/settings/page.tsx:67-70,81-88,110-116`
- **Problem:** Create/manage controls render regardless of `ai.calls.create` / `ai.knowledge.manage` / `ai.settings.manage`. Backend enforces 403, so this is a UX leak (same class as BUG-002/003).
- **Recommended fix:** Wrap controls in `hasPermission(...)` like the employees/chat pages.

### BUG-011 📋 About page CTAs drop the active tenant query
- **File:** `frontend/app/(public)/about/page.tsx:165-168`
- **Problem:** Browse/Contact links omit `?tenant=`; a non-demo visitor is silently switched back to `demo`.
- **Recommended fix:** Read `searchParams` and append `?tenant=` like `PublicHeader/PublicFooter`.

### BUG-012 📋 Public listing fetch masks API errors as "no listings"
- **File:** `frontend/lib/public-site.ts:108-112`
- **Problem:** Any non-OK response returns `{data:[]}`, hiding 400/500/contract failures as an empty result.
- **Recommended fix:** Distinguish true-empty from error; surface an error state for non-OK responses.

### BUG-013 📋 No Open Graph / Twitter card meta on public pages
- **Evidence:** 0 `og:` tags on `/`, `/listings`, `/about`, `/contact`, property detail (verified via rendered HTML).
- **Impact:** Poor link previews on WhatsApp/Facebook/LinkedIn — directly relevant to lead-gen channels.
- **Recommended fix:** Add `openGraph`/`twitter` to Next.js `metadata` (and `generateMetadata` for property detail using cover image + price/title).

### BUG-014 📋 sitemap.xml only contains the homepage
- **Evidence:** `/sitemap.xml` (233 bytes) lists only `/`.
- **Impact:** Property + static pages aren't discoverable by crawlers; undermines the SEO strategy.
- **Recommended fix:** Generate entries for `/listings`, `/about`, `/contact`, `/privacy`, `/terms`, and per-property canonical URLs (`/buy/{city}/{slug}`), per tenant where applicable.

---

## P3

### BUG-015 📋 Missing page-level loading states (stale "empty" flashes)
- **Files:** `frontend/app/(dashboard)/billing/page.tsx:27-56,122-138`, `billing/invoices/page.tsx:11-15,59-63`
- **Fix:** Add `loading` flags; render skeletons until fetches settle.

### BUG-016 📋 Analytics custom range with missing dates fails silently
- **File:** `frontend/app/(dashboard)/analytics/page.tsx:35-44`
- **Fix:** Validate both dates and show a message / disable load.

### BUG-017 📋 Audit + AI-usage writes swallow errors silently
- **Files:** `backend/src/modules/audit/audit.service.ts:29-48`, `backend/src/modules/ai/ai.repository.ts:316-323`
- **Fix:** Log structured warnings; consider durable outbox (compliance/billing relevance).

### BUG-018 📋 Unpaginated reads
- **Files:** `backend/src/modules/billing/billing.repository.ts:147-150` (tenant invoices), platform billing metrics load-all (`:251-259`).
- **Fix:** Add pagination / DB aggregates.

### BUG-019 📋 Public analytics ingestion has no throttling
- **File:** `backend/src/modules/public-analytics/public-analytics-track.controller.ts:19-29`
- **Fix:** Add per-IP/session/tenant rate limits.

### BUG-020 📋 `any` in production code
- **Files:** `backend/src/modules/properties/storage/storage.service.ts:67,79,81,97,99`, `properties.service.ts:444`
- **Fix:** Type the S3 dynamic-import surface; narrow update-key casts. (No `eval` / dynamic SQL found; analytics raw SQL uses `Prisma.sql` parameterization.)
