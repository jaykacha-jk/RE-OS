# RE-OS — Role & Permission Matrix Audit

**Stance:** Security + Product, verified against `backend/prisma/seed.js`, `backend/src/common/guards`, controllers, and `frontend/components/admin/nav-config.ts`.
**Date:** 2026-06-12

> **Key finding:** The system now ships **6 internal roles**. The documented **`client`** (buyer) role is still roadmap-only; the stale `marketing_user` accept-path was removed from employee DTOs and runtime allowlists.

---

## 1. Roles — Documented vs Actual

| Role | In `RBAC.md`? | Seeded in code? | Status |
|---|:--:|:--:|---|
| `super_admin` | ✅ | ✅ | OK |
| `org_owner` | ✅ | ✅ | OK |
| `org_admin` | ✅ | ✅ | OK |
| `sales_manager` | ✅ | ✅ | OK |
| `sales_executive` | ✅ | ✅ | OK |
| `telecaller` | ✅ | ✅ | OK |
| `client` (buyer) | ✅ | ❌ | **Missing** — no buyer auth role; public users are anonymous. |
| `marketing_user` | Roadmap/docs only | ❌ | ✅ Removed from employee create/update DTOs and runtime allowlists to match the six seeded roles. |

---

## 2. Per-Role Audit

### Super Admin (`super_admin`)
- **Purpose:** Platform operator (you), not a tenant user.
- **Allowed:** Platform org CRUD, platform analytics/billing metrics; `PermissionsGuard` grants a global bypass for super_admin.
- **Denied:** Tenant-scoped routes — `TenantGuard` blocks because Super Admin has **no `tenant_id`**. So Super Admin can't operate *inside* a tenant (correct isolation, but no impersonation).
- **Missing:** `platform.impersonate` (documented, not seeded). No safe "support login as tenant".
- **Navigation:** Redirected to `/platform/organizations`. Clean.

### Org Owner (`org_owner`)
- **Purpose:** Agency principal / buyer.
- **Allowed:** Employees CRUD, properties CRUD+assign, all CRM, all chat, audit read, notification templates, **billing read+update**, **all settings incl. feature flags + white-label**, full AI.
- **Denied:** Nothing meaningful within tenant.
- **Assessment:** Correct. This is the decision-maker; broad access is intended.

### Org Admin (`org_admin`)
- **Allowed:** Same as owner **minus** feature flags + white-label; **billing read-only**.
- **Assessment:** Sensible separation (admin runs ops, owner owns money + brand). ✅

### Sales Manager (`sales_manager`)
- **Allowed:** Properties read/update/assign, analytics, team CRM (no delete / no source mgmt), chat manager scope, notifications, settings read, AI manager bundle.
- **Navigation:** `/employees` is now gated by `employees.read`; managers without the permission no longer see a dead menu item.
- **Assessment:** Functional team-scoped role; previous nav mismatch is fixed.

### Sales Executive (`sales_executive`)
- **Allowed:** Assigned-scope property read/update, CRM create/read/update + notes/followups/site-visits, assigned chat, notifications, AI sales bundle.
- **Assessment:** Correct daily-driver scoping (service-layer `assigned` scope enforced). ✅

### Telecaller (`telecaller`)
- **Allowed:** Assigned-scope property read, analytics, CRM **assigned read + notes + followups**, lead-source read, assigned chat, notifications, AI sales bundle.
- **Denied:** Cannot create/update inquiries; cannot schedule site visits.
- **Assessment:** Calling workflow now has assigned property context while preserving restricted CRM writes.

### Client / Buyer
- **Reality:** No authenticated buyer role. Buyers are anonymous public-site visitors who submit inquiries via `POST /api/v1/public/{tenant}/inquiries`. No login, saved properties, or profile.
- **Impact:** "Saved properties", "client portal", buyer accounts (all in docs) are **not implemented**.

---

## 3. Enforcement Quality

| Layer | Mechanism | Verdict |
|---|---|---|
| Authentication | `JwtAuthGuard` (RS256) | ✅ Strong |
| Tenant boundary | `TenantGuard` (JWT `tid`) | ✅ Good (not from client body) |
| Authorization | `PermissionsGuard` + `@RequirePermissions` per controller | ✅ Consistent, but **not a global guard** |
| Data scoping | Service-layer `full / team / assigned` resolution (properties, CRM, analytics, chat, AI calls) | ✅ Real and tested |
| Field-level visibility | Role-aware DTO stripping | ✅ CRM inquiry responses strip restricted-role PII; telecallers keep dialable phone/WhatsApp but lose email, budget, lead score, remarks, and note text. |
| Frontend gating | `nav-config.ts`, `PermissionGate.tsx`, shell redirects | ✅ Visibility only (correct — backend is source of truth) |

---

## 4. "Should Admin see X?" (Part 5 of brief)

| Surface | Org Admin sees it? | Correct? |
|---|:--:|---|
| Properties, CRM, Employees, Analytics, Chat, Notifications, Settings | ✅ | ✅ |
| **Billing** | ✅ read-only | ✅ (owner controls money) |
| **White-label** | ❌ | ✅ (owner-only is right) |
| **Feature flags** | ❌ | ✅ (owner-only is right) |

The owner/admin billing & branding split is well-designed and matches good multi-tenant SaaS practice.

---

## 5. Role Audit Scores

| Aspect | Score | Note |
|---|:---:|---|
| Role model design | 7/10 | Good internal hierarchy; missing buyer + marketing roles. |
| Permission correctness | 8/10 | Solid seeded-role model; remaining drift is mostly roadmap buyer/client docs. |
| Enforcement robustness | 8/10 | Strong guards + scoping; CRM field-level stripping added; no global guard. |
| Docs↔code accuracy | 6/10 | `RBAC.md` is closer to shipped roles; buyer/client docs remain roadmap-heavy. |

---

## 6. Required Fixes (priority)

1. ✅ Removed **`marketing_user`** from employee create/update DTOs and runtime role allowlists.
2. **Reconcile `RBAC.md`** to the 6 real roles; decide if `client`/buyer accounts are roadmap or cut.
3. ✅ **Fix manager nav**: `/employees` is gated on `employees.read`.
4. ✅ **Add field-level DTO stripping** for sensitive CRM PII per role (implemented for CRM inquiry DTOs).
5. **Decide on Super Admin impersonation** (seed `platform.impersonate` + audited support-login) — needed for real customer support.
