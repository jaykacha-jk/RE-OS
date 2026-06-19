# Real Estate SaaS — Prioritized Punch List
**Source:** Codebase audit, June 18, 2026 | **Repo:** realEstate (NestJS + Next.js + Prisma/PostgreSQL)

Each item lists the file(s) involved, why it matters, and a rough sense of effort. P0 = security/data-integrity, fix before next release. P1 = should land this sprint. P2 = real but can wait. P3 = product decision needed, not a code task.

---

## P0 — Security & Data Integrity (fix before next release)

### P0-1. Property image upload has no server-side validation ✅ DONE
**Files:** `properties.service.ts:672-696`
**Issue:** Only client checks `file.type.startsWith('image/')` (`property-image-manager.tsx:60-61`). Server stores arbitrary base64 with no size or MIME enforcement. Anyone hitting the API directly can upload any file as a "property image" — storage DoS risk.
**Fix:** Port the validation pattern already used correctly in chat attachments (`chat.service.ts:793-801`, `chat.constants.ts:72-86`) — 10MB cap + MIME allowlist, enforced server-side.
**Effort:** Small (half day). Pattern already exists in the codebase, just needs reuse.

### P0-2. AI voice webhook signature bypass in non-production ✅ DONE
**Files:** `mock.provider.ts:145-147`, `ai-config.controller.ts:211-220`
**Issue:** `verifyWebhookSignature()` returns `true` whenever `NODE_ENV !== 'production'`. Endpoint has no JWT — auth is 100% dependent on this check. If a staging/internal env doesn't have `NODE_ENV` set correctly, the webhook is wide open.
**Fix:** Make signature verification fail-closed always. Use an explicit `MOCK_AI_PROVIDER=true` env flag for dev convenience instead of inferring "not production" from `NODE_ENV`.
**Effort:** Small (few hours).

### P0-3. Employees API returns fabricated KPI data ✅ DONE
**Files:** `employees.service.ts:75-76`
**Issue:** `properties_assigned_count` and `open_inquiries_count` are hardcoded to `0`, not computed. This isn't a missing feature — it's a wrong number presented as real data. Anyone viewing the employee list today sees incorrect counts with no indication they're stubbed.
**Fix:** Either compute real counts (join/aggregate query) or remove the columns until they're real. Showing `0` is worse than showing nothing.
**Effort:** Medium (1-2 days depending on query complexity across tenant scope).

---

## P1 — This Sprint

### P1-1. Org/Employee listing pages ignore server-side pagination & filters ✅ DONE
**Files:** `frontend/app/(dashboard)/platform/organizations/page.tsx` (lines 57, 143-148), `frontend/app/(dashboard)/employees/page.tsx` (lines 75, 85-90)
**Issue:** Backend already supports `filter[status]`, `filter[tier]`, `filter[role]`, `page`, `per_page` — none of it is wired into the UI. Pages fetch only the default first page and do client-side string search. Once data grows past one page, results silently truncate with no error shown.
**Fix:** Wire existing query params into the API calls; replace client-side search/pagination hooks with server-backed equivalents (already proven pattern in Properties and Inquiries pages — copy that approach).
**Effort:** Medium (1 day per page, ~2 days total). No backend work needed.

### P1-2. Latitude/longitude accepted by API, missing from property form ✅ DONE
**Files:** `create-property.dto.ts` (backend), `frontend/app/(dashboard)/properties/property-form.tsx`
**Issue:** Field exists end-to-end in DB and DTO but has no UI. Map integration (also flagged as missing in the audit) depends on this being populated.
**Fix:** Add lat/lng fields to the property form — either manual entry or a map-picker widget if you want map integration sooner rather than later.
**Effort:** Small for manual fields (half day); Medium-Large if bundled with actual map picker UI.

### P1-3. Employee peer-access restriction not enforced ✅ DONE
**Files:** `employees.service.ts:152-155`
**Issue:** Per the intended permission model, a Sales role viewing another employee's detail (`GET /employees/:id`) should get a 403 for peers. Code currently only checks tenant match, not role hierarchy/ownership.
**Fix:** Add the rank/ownership check already used elsewhere in this service (`ROLE_RANK` logic at lines 21-27, 99-127) to the single-employee GET path.
**Effort:** Small (few hours) — the pattern to copy already exists in the same file.

### P1-4. Org logo not uploadable ✅ DONE
**Files:** Platform organization create/edit DTOs, `frontend/app/(dashboard)/platform/organizations/page.tsx` (267-301)
**Issue:** `logo_url` exists in the DB but there's no upload endpoint or UI field — branding is URL-text-only and not exposed in the platform admin UI at all.
**Fix:** Decide whether this matters for launch (see P3-2 below) — if yes, add file upload using the existing `StorageService` pattern used for property images/chat.
**Effort:** Small-Medium (depends on whether you reuse StorageService directly).

### P1-5. Billing email can't be edited from the Org edit form ✅ DONE
**Files:** `frontend/app/(dashboard)/platform/organizations/page.tsx` (lines 88-89, 132)
**Issue:** Backend `UpdateOrganizationDto` supports updating `billing_email`, but the frontend edit form clears it and the PATCH call only sends `{ name, status, tier }`. Super Admin literally cannot change a customer's billing email without a DB edit.
**Fix:** Add `billing_email` to the edit form and include it in the PATCH payload.
**Effort:** Small (few hours).

---

## P2 — Real, Can Wait

### P2-1. No `GET /platform/organizations/:id` detail endpoint ✅ DONE
**Files:** `platform.controller.ts`
**Issue:** List endpoint exists, single-org detail fetch doesn't. Minor — likely fine if the list view carries enough data for now.
**Effort:** Small.

### P2-2. Property form has no bulk CSV upload (spec'd in original flow doc) ✅ DONE
**Issue:** Org Admin onboarding flow describes "50 flats upload via CSV" — not implemented. Manual single-property creation only.
**Effort:** Medium — needs CSV parsing, validation, partial-failure handling, and a results UI (which rows succeeded/failed).

### P2-3. No "Nearby Places" or Map integration on Property ✅ DONE
**Issue:** Spec'd, not built. Depends on P1-2 (lat/lng) landing first.
**Shipped:** OpenStreetMap embed on property detail; nearby amenities/transit via Overpass API (`GET /properties/nearby-places`); geocode lookup on property form (`GET /properties/geocode`). No paid third-party Places API.
**Effort:** Large if done properly (third-party places API integration) — deferred in favor of free OSM stack.

### P2-4. Property video upload has no UI (API-only) ✅ DONE
**Files:** `AddVideoDto` exists; no corresponding frontend component.
**Effort:** Medium.

### P2-5. Invoice PDF generation unverified ✅ DONE
**Files:** `invoices.pdf_url` field exists in schema; generation path not confirmed working end-to-end.
**Effort:** Unknown until traced — could be done or could be a stub field.

### P2-6. `before_state`/`after_state` not shown in Audit Log UI ✅ DONE
**Files:** `frontend/app/(dashboard)/audit-logs/page.tsx`
**Issue:** Data is captured and stored, just not rendered — makes audit logs less useful for actually diagnosing what changed.
**Effort:** Small — likely a diff-view component addition.

---

## P3 — Product Decisions Needed (not code tasks yet)

### P3-1. There is no authenticated Client/User role ✅ DECIDED (post-MVP)
**Issue:** The original spec describes clients logging in to see "My Saved Properties," inquiry status, etc. The actual system only has internal staff roles plus anonymous public visitors using token-based chat/inquiry forms.
**Decision (2026-06-18):** **Staff-only CRM for MVP launch.** Public visitors browse listings and submit inquiries without login; client portal / saved properties deferred to post-MVP (aligns with `docs/PRD.md` §2 and MVP scope in business rules).

### P3-2. Hidden-but-reachable modules (Chat, Audit Logs, most AI pages) ✅ DONE
**Files:** `nav-config.ts` — `LAUNCH_HIDDEN_NAV_IDS`
**Issue:** These modules are fully built on the backend and reachable by direct URL, just hidden from the sidebar nav. That's a UX/launch-readiness gate, not real access control — if any of these aren't actually ready for users to touch, the permission layer (not just the nav) should reflect that.
**Shipped:** `getDashboardRouteAccess()` blocks direct URL access to launch-hidden routes when `NEXT_PUBLIC_REOS_LAUNCH_MODE` is not `false` (same set as sidebar hiding). Set env to `false` to expose modules for internal QA.

### P3-3. `marketing` role referenced in RBAC constants with no clear module ✅ DONE
**Files:** Referenced in property/analytics RBAC constants per audit, not in seed roles (`seed.js:385-391`)
**Decision (2026-06-18):** **`marketing_user` is post-MVP.** Removed from employee create/update DTOs and runtime allowlists; `PROPERTY_FULL_ACCESS_ROLES` lists only seeded roles. PRD §2 marks Marketing User as post-MVP.

### P3-4. Spec vocabulary doesn't match implemented enums ✅ DONE
**Issue:** Spec describes property status as "Available/Sold" and a "Req Complete" field; actual implementation uses `draft|pending_review|published|reserved|sold|archived` with no "Req Complete" concept at all.
**Shipped:** `docs/PRD.md` §4.3 updated to shipped enums; requirement fulfillment documented as inquiry pipeline concern, not a property field.

---

## Suggested Sequencing

1. **This week:** P0-1, P0-2 (both small, both security-relevant, both have ready-made patterns elsewhere in the codebase to copy)
2. **This sprint:** P0-3, P1-1 through P1-5 (all bounded, all have clear fixes, no open design questions)
3. **Before next planning session:** ~~Resolve P3-1 through P3-4 as decisions~~ — **resolved 2026-06-18** (see P3 section above)
4. **Backlog:** ~~P2 items~~ — **punch list complete** for code fixes; post-MVP: client portal, `marketing_user` role, paid Places API if needed