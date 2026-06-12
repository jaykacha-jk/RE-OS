# RE-OS Design System

The single source of truth for the admin UI's visual language. Tokens live in
`frontend/app/globals.css` (CSS variables + component layer) and
`frontend/tailwind.config.js` (theme extension). Prefer these tokens and the
semantic component classes over ad-hoc utility combinations.

---

## 1. Brand & Color

### Brand
| Token | Hex | Usage |
|-------|-----|-------|
| `reos.primary` | `#0f766e` | Primary actions, active states, links |
| `reos.primaryStrong` | `#115e59` | Hover/pressed primary |
| `reos.primarySoft` | `#ccfbf1` | Tints, selection background |
| `reos.gold` | `#b7791f` | Accent (conversion line, premium) |
| `reos.goldSoft` | `#fef3c7` | Accent tint |

### Surfaces & Ink
| Token | Hex | Usage |
|-------|-----|-------|
| `reos.bg` | `#f6f8f9` | App background |
| `reos.surface` | `#ffffff` | Cards, panels |
| `reos.muted` | `#f1f5f4` | Inset fields, search bar |
| `reos.border` | `#e3e9e7` | Hairline borders |
| `reos.borderStrong` | `#cbd6d2` | Scrollbars, dividers |
| `reos.ink` | `#0f172a` | Primary text |
| `reos.subtle` | `#5b6b7b` | Secondary text |
| `reos.sidebar` | `#0b1220` | Sidebar background (dark navy) |
| `reos.sidebarSoft` | `#131c2e` | Sidebar raised surfaces |

### Semantic status (Tailwind palette)
`emerald` = success/won · `amber` = warning/trial · `rose` = danger/lost ·
`indigo`/`blue` = info/qualified · `teal` = brand/primary · `slate` = neutral.

---

## 2. Typography

System UI stack with optical features enabled (`--font-reos-sans`). Use the
semantic classes — never hand-pick `text-3xl font-bold` per page.

| Class | Size / Weight | Usage |
|-------|---------------|-------|
| `.text-display` | 30→36px / 700 | Page hero titles |
| `.text-h1` | 24px / 700 | Page titles |
| `.text-h2` | 18px / 700 | Section titles |
| `.text-h3` | 16px / 600 | Card titles |
| `.text-body` | 14px / 400 (lh 24) | Body copy |
| `.text-caption` | 12px / 400 | Helper text |
| `.text-overline` | 11px / 700 uppercase, 0.16em tracking | Labels above metrics |
| `.text-2xs` (utility) | 11px | Micro labels, badges, timestamps |

Numbers in metrics use `tabular-nums` for alignment.

---

## 3. Spacing & Layout

4px base scale exposed as `--space-1..12`. Conventions:

- **Section rhythm:** `space-y-6` between major dashboard sections; `space-y-5` inside columns (`.section-gap`).
- **Card padding:** `p-5` standard.
- **Page container:** `max-w-[88rem]`, padding `px-4 sm:px-6 lg:px-8`, `py-6 lg:py-8`.
- **Dashboard grid:** 12-column (`lg:grid-cols-12`) → 8-col main + 4-col rail. Eliminates the previous empty gutters.

---

## 4. Radius & Elevation

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-xl` | 12px | Buttons, inputs, list rows |
| `rounded-2xl` | 16px | Cards, panels, dropdowns |
| `rounded-3xl` | 24px | Large feature surfaces |

| Shadow | Usage |
|--------|-------|
| `shadow-card` | Resting cards |
| `shadow-raised` | Hover lift |
| `shadow-dropdown` | Menus, tooltips |
| `shadow-premium` | Modals / command palette |

---

## 5. Component Classes

**Buttons:** `.btn-primary` · `.btn-secondary` · `.btn-ghost` · `.btn-danger`
(all share gap, focus ring, disabled styling).

**Inputs:** `.input` (focus ring `ring-4 ring-teal-100`).

**Surfaces:** `.card` (+ `.card-hover` for interactive lift) · `.panel` (legacy alias).

**Badges:** `.badge` + variant (`.badge-teal/green/amber/rose/indigo/slate`).

**Navigation:** `.sidebar-link` + `.sidebar-link-active`.

**Misc:** `.kbd` (keyboard hints) · `.scrollbar-thin` (slim scrollbars) ·
`.eyebrow`, `.page-title`, `.page-subtitle` (legacy aliases kept for older pages).

---

## 6. Iconography

Single dependency-free set: `frontend/components/ui/icons.tsx` → `<Icon name="…" />`.

- 24×24 grid, 1.75 stroke, `currentColor`, rounded caps/joins.
- 35+ named icons covering every nav destination + UI affordances.
- Always `aria-hidden`; pair with a text label or `aria-label`.

```tsx
import { Icon } from '@/components/ui/icons';
<Icon name="properties" className="h-5 w-5 text-teal-700" />
```

---

## 7. Motion

Defined in `tailwind.config.js`:

| Animation | Usage |
|-----------|-------|
| `animate-fade-in` (0.15s) | Overlays/scrims |
| `animate-scale-in` (0.14s) | Dropdowns, command palette, menus |
| `animate-slide-in-left` (0.2s) | Mobile navigation drawer |

Keep transitions ≤ 200ms; interactive lifts use `duration-150`.

---

## 8. Accessibility Baseline

- Global `:focus-visible` outline (2px `reos.primary`, 2px offset) on all interactive elements.
- Active nav uses `aria-current="page"`.
- Icon-only controls carry `aria-label` (search, logout, notifications).
- Command palette is a labelled `role="dialog" aria-modal`, fully keyboard-driven (↑/↓/↵/Esc).
- Menus use `role="menu"`/`menuitem`, close on `Esc` and outside-click.
- Color is never the sole signal — status pairs a colored dot **and** a text label.

---

## 9. Usage Rules

1. Reach for a **semantic class** before raw utilities.
2. New colors must be added as a `reos.*` token, not inline hex.
3. Headings use the type scale; do not introduce new sizes per page.
4. Every icon-only control needs an `aria-label`.
5. Interactive cards: `.card .card-hover`; static: `.card`.
