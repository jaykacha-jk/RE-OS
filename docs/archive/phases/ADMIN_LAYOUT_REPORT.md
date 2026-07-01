# RE-OS — Admin Layout Report (Phase 11B)

**Date:** 2026-06-12
**File:** `frontend/components/admin/admin-shell.tsx`

## Problem

The admin shell scrolled as a single document: the sidebar was `sticky top-0
h-screen` inside a `flex min-h-screen` container, so the **whole page** scrolled
and the header rode along with the body. This produced the "sidebar and content
scroll together" behavior called out in the brief.

## Fix — proper app-shell layout

| Element | Before | After |
|---------|--------|-------|
| Root | `flex min-h-screen` | `flex h-screen overflow-hidden` |
| Sidebar `<aside>` | `sticky top-0 h-screen` | `h-screen` (fixed within the flex row) |
| Content column | `flex flex-1 flex-col` | `flex flex-1 flex-col overflow-hidden` |
| Header | `sticky top-0 z-30` | `z-30 shrink-0` (pinned above the scroll pane) |
| Main | `mx-auto max-w-[88rem] flex-1` (page scroll) | `flex-1 overflow-y-auto scrollbar-thin` with a centered inner `max-w-[88rem]` wrapper |

### Resulting behavior

```
┌──────────┬────────────────────────────┐
│ Sidebar  │ Header (fixed)             │
│ (fixed,  ├────────────────────────────┤
│  internal│ Main content               │
│  scroll) │ (independent vertical scroll)│
│          │                            │
└──────────┴────────────────────────────┘
```

- **Sidebar**: full viewport height; its nav already has `overflow-y-auto`, so a
  long menu scrolls inside the sidebar without moving the content.
- **Header**: stays pinned; never scrolls away.
- **Main**: the only vertical scroll container; the scrollbar sits at the viewport
  edge while content stays centered at `max-w-[88rem]`.
- **No double scrollbars**, no page jump.

### Responsive

- **Desktop (≥1024px)**: sidebar visible and fixed.
- **Tablet/Mobile (<1024px)**: sidebar hidden; opened via the header menu button
  as a `fixed inset-0` drawer with overlay. Content pane still scrolls
  independently. The drawer closes on navigation.

## Already-present admin UX (verified, not rebuilt)

The brief listed several items as "to add" that already exist:

| Item | Location |
|------|----------|
| Global search | header search button → command palette |
| Command bar (Ctrl/Cmd+K) | `command-palette.tsx` + key handler in `admin-shell.tsx` |
| Notification center | `notification-bell.tsx`, `notification-dropdown.tsx`, `/notifications` |
| Profile dropdown | `components/admin/user-menu.tsx` |
| Quick create | header "Add property" (permission-gated) |
| Workspace switcher | sidebar link (Platform/Workspace) |
| Empty states / skeletons | `components/analytics/chart-card.tsx`, list pages |

## Remaining gaps (follow-ups)

- True multi-org **switcher** (dropdown) for users belonging to multiple orgs —
  low value for current single-org users.
- Sticky table headers within long tables (separate from horizontal overflow,
  which is fixed — see RESPONSIVE_AUDIT_REPORT.md).

## Completion

Admin layout objective (independent scrolling app shell): **100%**.
