# RE-OS UI/UX Guidelines

**Version:** 1.0  
**Design system:** shadcn/ui + Tailwind CSS

---

## 1. Design Principles

1. **Clarity over density** — sales users on mobile; avoid crowded tables  
2. **Action-oriented** — primary CTA per screen (Assign, Call, Schedule visit)  
3. **Role-aware** — show only what RBAC allows; no disabled mystery buttons  
4. **Trust** — professional aesthetic for B2B; property imagery hero on public pages  
5. **Speed** — optimistic updates where safe; skeleton loaders  

---

## 2. Typography

| Token | Font | Usage |
|-------|------|-------|
| `--font-sans` | Inter (Google) | UI, tables, forms |
| `--font-display` | Inter | Headings (weight 600–700) |

| Scale | Size | Usage |
|-------|------|-------|
| h1 | 2rem | Page title |
| h2 | 1.5rem | Section |
| body | 0.875rem–1rem | Default |
| caption | 0.75rem | Meta, timestamps |

---

## 3. Color Palette

| Token | Light | Usage |
|-------|-------|-------|
| `--primary` | `#0F766E` (teal-700) | Primary actions, links |
| `--primary-foreground` | `#FFFFFF` | On primary |
| `--secondary` | `#F1F5F9` | Secondary buttons |
| `--destructive` | `#DC2626` | Delete, errors |
| `--muted` | `#64748B` | Secondary text |
| `--accent` | `#F59E0B` | Hot leads, urgency tags |
| `--background` | `#FFFFFF` | Page bg |
| `--card` | `#FFFFFF` | Cards with border |
| `--border` | `#E2E8F0` | Dividers |

**Dark mode:** supported Phase 2+; use shadcn CSS variables.

**Tenant branding (Phase 9):** override `--primary` only; keep contrast WCAG AA.

---

## 4. Spacing & Layout

- Base unit: 4px  
- Page padding: `p-6` desktop, `p-4` mobile  
- Card gap: `gap-4`  
- Max content width admin: `max-w-7xl`  
- Public listing: full width with `max-w-6xl` content  

---

## 5. Components (shadcn)

Required primitives: Button, Input, Select, Table, Dialog, Sheet, Tabs, Badge, Avatar, DropdownMenu, Toast, Calendar, Command (search), DataTable.

**Data tables:**

- Sortable columns where listed in PRD  
- Sticky header on long lists  
- Row actions in `⋯` menu  
- Empty states with illustration + CTA  

---

## 6. Navigation

### Admin (tenant)

```
Dashboard
Properties
Inquiries
Employees (admin+)
AI Calls
Chat
Reports (manager+)
Settings
Billing (owner+)
```

Sidebar collapsible on mobile → drawer.

### Public

```
Home | Buy | Rent | Contact
Footer: org NAP, social
Floating chat widget (Phase 6)
```

---

## 7. Key Screen Patterns

### Inquiry Kanban

- Columns = pipeline stages  
- Cards: client name, budget, assigned avatar, overdue badge  
- Drag-drop with confirmation on stage regression  

### Property Detail (Public)

- Hero image carousel  
- Price prominent (INR formatted `₹85,00,000`)  
- Sticky mobile bar: Call | Chat | Inquiry  

### Dashboard

- KPI cards top row (4 max)  
- Charts below (recharts)  
- Recent inquiries table  

---

## 8. Forms

- Labels always visible (no placeholder-only)  
- Inline validation on blur  
- Zod errors mapped to fields  
- Phone input with +91 default for India  
- Currency inputs with lakh/crore helper optional  

---

## 9. Accessibility

- WCAG 2.1 AA target  
- Focus rings visible  
- Icon buttons have `aria-label`  
- Color not sole indicator (icons + text for status)  

---

## 10. Motion

- Transitions 150–200ms ease  
- No gratuitous animation  
- Skeleton pulse for loading  

---

## 11. Anti-Patterns

- Generic purple AI gradient slop  
- 12-column filters visible at once — use filter sheet  
- Exposing internal UUIDs to client role  
- Modal on modal stacks  

---

*RBAC visibility: [RBAC.md](./RBAC.md). SEO public pages: [SEO_STRATEGY.md](./SEO_STRATEGY.md).*
