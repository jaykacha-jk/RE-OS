# RE-OS — Responsive Audit Report (Phase 11B)

**Date:** 2026-06-12
**Breakpoints reviewed:** 320px, 768px, 1024px, 1440px
**Method:** Static review of Tailwind responsive utilities in changed/affected
components + production build. (Live pixel QA across devices is a recommended
follow-up using the in-repo browser tooling.)

## Summary

Most pages already use responsive grids (`sm:`, `lg:` prefixes) and the analytics
components ship with responsive card grids. Phase 11B addressed two structural
risks: (1) the public site had no responsive header/footer, and (2) wide admin
tables could be clipped on small screens.

## Public website

| Component | 320px | 768px | 1024px+ |
|-----------|-------|-------|---------|
| Public header | Logo + hamburger; full menu in drawer | same | Full inline nav + Login/CTA |
| Public footer | Single column → 2-col link grid | 3-col link grid | 2-zone (brand+newsletter / links) |
| Home hero | Stacked; search wraps | Stacked | 2-column hero |
| About / Contact | Single column sections | 2-col where defined | Full multi-column |
| Contact form | Fields stack | 2-up field rows (`sm:grid-cols-2`) | same |
| Listing/property grids | 1 col | 2 col (`sm:`) | 3 col (`lg:`) |

## Admin

| Area | Behavior |
|------|----------|
| Sidebar | Hidden <1024px, drawer with overlay; fixed ≥1024px |
| Header | Search collapses; kbd hint hidden <640px; "Add property" hidden <768px |
| Main content | Independent vertical scroll; centered `max-w-[88rem]` |
| Tables | Horizontal scroll containers (see below) |
| Cards/charts | Analytics grids are responsive (`grid` + `sm:`/`lg:`) |

## Table overflow fixes

Wide data tables previously used `overflow-hidden`, which **clips** wide content
instead of allowing scroll. Switched to `overflow-x-auto` (with `scrollbar-thin`):

| Page | File | Change |
|------|------|--------|
| Audit logs | `app/(dashboard)/audit-logs/page.tsx` | `overflow-hidden` → `overflow-x-auto` |
| Invoices | `app/(dashboard)/billing/invoices/page.tsx` | `overflow-hidden` → `overflow-x-auto` |
| Organizations | `app/(dashboard)/platform/organizations/page.tsx` | `overflow-hidden` → `overflow-x-auto` |
| Employees | `app/(dashboard)/employees/page.tsx` | `overflow-hidden` → `overflow-x-auto` |
| Domain DNS records | `app/(dashboard)/settings/domains/page.tsx` | Wrapped table in `overflow-x-auto` |

Already correct (no change needed): Properties and Inquiries tables already used
`overflow-x-auto`; the pipeline board already uses `overflow-x-auto`.

## Remaining gaps (follow-ups)

- Live device/browser QA pass (the static review can't catch every pixel issue).
- Sticky `<thead>` on long tables for large datasets.
- A few AI tables (`ai/calls`, `ai/knowledge`) use `w-full` + `overflow-hidden`;
  low risk (few columns) but could adopt the same scroll wrapper for consistency.

## Completion

Responsive structure for Phase 11B scope: **~90%** (pending live device QA).
