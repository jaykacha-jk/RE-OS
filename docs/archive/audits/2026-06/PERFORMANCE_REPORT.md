# RE-OS — Performance Report (Phase 11C)

**Date:** 2026-06-12
**Method:** Static analysis of query patterns + live endpoint/page response sizing.

---

## 1. Live Observations
- Backend reads (properties/inquiries/analytics/billing/settings) all returned **200** quickly under single-user load; pagination caps enforced (`per_page` max 100).
- Property detail page is ~**111 KB** of HTML (image-rich SSR) — acceptable, but a candidate for image lazy-loading / `next/image`.
- `/listings` index ~**184 KB** — review payload if property counts grow (paginate/virtualize).

> Note: measurements are single-user dev-mode (Next.js dev build is unoptimized). Re-measure against `next build`/production for true numbers.

---

## 2. Findings (static)

### P2 — Heavy / unbounded reads
| ID | File:line | Problem | Fix |
|----|-----------|---------|-----|
| PERF-01 | `billing/billing.repository.ts:251-259` | Platform metrics load **all** subscriptions + invoices + payments into memory | Use Prisma `groupBy`/`aggregate` with date bounds |
| PERF-02 | `analytics/analytics.repository.ts:167-176` + `analytics.service.ts:196-207` | Revenue analytics fetch every won deal in range and sum in Node | Aggregate in SQL; index `(tenant_id, stage, closed_at)` |
| PERF-03 | `ai/ai.repository.ts:232-237`, `ai/services/knowledge-base.service.ts:176-180` | RAG search loads up to **500** full docs + embeddings, ranks in memory | Vector index / prefilter / `select` minimal fields / tighter limit |
| PERF-04 | `billing/billing.repository.ts:147-150` | Tenant invoice list unpaginated | Add `page/per_page`, cap `take` |

### P3 — N+1 / write-in-loop
| ID | File:line | Fix |
|----|-----------|-----|
| PERF-05 | `properties/properties.repository.ts:296-297,345-346,465-466` | Batch with `createMany`/`updateMany`/transaction |
| PERF-06 | `crm/crm.repository.ts:284-285` | Batch inserts |
| PERF-07 | `ai/services/followup-automation.service.ts:45-47` | Batch writes |

### P3 — Indexing / ingestion
- Add composite indexes supporting the hot analytics aggregates (PERF-02) and public-analytics queries.
- Public analytics ingestion endpoint lacks throttling (also a DoS/cost concern) — `public-analytics-track.controller.ts:19-29`.

---

## 3. Frontend Render
- No obvious heavy re-render loops found in audited pages; most lists fetch once on mount.
- Recommendation: switch property images to `next/image`, add list virtualization on `/listings` and large admin tables before scaling demo data.

---

## 4. Priority
1. PERF-01/02 (analytics + platform metrics) — first to bite as tenant data grows.
2. PERF-03 (RAG) — relevant once AI usage increases.
3. PERF-04..07 — correctness-adjacent; fix opportunistically.

None of these block beta at current seed volumes (100 properties/org), but PERF-01/02 should be scheduled before onboarding large tenants.
