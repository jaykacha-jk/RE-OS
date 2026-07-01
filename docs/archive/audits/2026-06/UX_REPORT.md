# RE-OS — UX Report (Phase 11C)

**Date:** 2026-06-12
**Method:** Read-only frontend audit (App Router: (auth)/(dashboard)/(admin)/(public)) + live rendering checks.

---

## 1. What's Working Well
- **List empty states** exist on properties, inquiries, employees, chat, notifications, billing invoices, audit logs.
- **Loading + error UX** is strong on properties & inquiries (skeletons + red error banners).
- **Transparent token refresh** (`lib/api.ts`) with single-flight + safe logout — no 401→refresh→401 loops.
- **Public pages** render (200) with unique titles for about/contact/privacy/terms; property detail carries JSON-LD; `robots.txt` correctly disallows admin areas.
- **Permission helpers** already exist (`lib/auth.ts`: `hasPermission`, `hasAnyRole`, `isSuperAdmin`) and are used on the chat page.

---

## 2. Issues & Fixes

### Fixed this pass
| ID | Area | Issue | Fix |
|----|------|-------|-----|
| UX-01 | Employees | Create/Remove visible to all roles (capability leak) | Gated by `employees.create` / `employees.delete` |
| UX-02 | Chat | "Close" visible without `chat.conversations.update` | Added `canClose` gate |
| UX-03 | AI Knowledge | `knowledge` type 400s on submit | Use `document` |
| UX-04 | Employees | Form offered non-existent `marketing_user` role | Removed |
| UX-05 | AI Prompts | Permanent "Loading…" on empty list | Added loading + empty state |

### Recommended (documented)
| ID | Area | Issue | Recommended fix |
|----|------|-------|-----------------|
| UX-06 | AI (calls/knowledge/settings) | Mutation controls not permission-gated | Wrap in `hasPermission(...)` |
| UX-07 | Public/About | CTAs drop `?tenant=` query → snaps back to demo | Append tenant from `searchParams` |
| UX-08 | Public listings | API errors shown as "no listings" | Distinguish empty vs error |
| UX-09 | Billing + Invoices | No page-level loading → stale "empty" flash | Add skeleton/loading |
| UX-10 | Analytics | Custom range with missing dates fails silently | Validate + message |
| UX-11 | SEO | No Open Graph/Twitter previews | Add `openGraph`/`twitter` metadata |

---

## 3. Design Audit Notes
- Consistent Tailwind design language (teal primary, slate neutrals); cards, tables, forms share spacing scale.
- Tables use `overflow-x-auto` wrappers → reasonable mobile behaviour. Prior `RESPONSIVE_AUDIT_REPORT.md` / `ADMIN_LAYOUT_REPORT.md` cover the layout pass.
- No broken-layout or overflow defects observed in rendered public pages.
- Recommendation: standardize a shared `<EmptyState>`, `<LoadingState>`, and `<PermissionGate>` component to remove the per-page inconsistencies above and prevent regressions.

---

## 4. Role-by-Role UX (post-fix)
| Role | Nav/actions correctness |
|------|------------------------|
| Super Admin | Platform org access works; tenant-only widgets hidden where applicable |
| Org Owner / Org Admin | Full management incl. employees create/delete |
| Sales Manager | CRM/pipeline/properties; employee management depends on granted perms |
| Sales Executive | Cannot create employees (UI + API); CRM access intact |
| Telecaller | Cannot manage properties/employees (UI gated + API 403) |

Backend enforces all of the above (verified, QA_REPORT §2.2). The fixes align the **UI** with that enforcement so restricted controls no longer appear-then-fail.
