# RE-OS Design System

**Version:** 1.0  
**Date:** 2026-06-10  
**Purpose:** Premium SaaS UI system for RE-OS admin, public website, and demo-ready real estate workflows.

---

## Product Context

RE-OS is a multi-tenant real estate operating system for Indian agencies, builders, sales teams, and platform operators. It manages properties, leads, CRM pipelines, chat, billing, analytics, notifications, public SEO pages, and tenant configuration.

The interface must feel like a serious B2B SaaS product and a premium real estate brand at the same time. The admin side should feel fast, trusted, and data-rich. The public side should feel refined, visual, and conversion-oriented.

---

## Design Principles

1. **Confidence before decoration**  
   Every screen should make the buyer believe the company is operationally mature.

2. **Real estate is visual**  
   Properties need imagery, locality, price, amenities, and status. Do not hide inventory inside plain tables when a card or preview adds confidence.

3. **Sales teams need next actions**  
   CRM screens should always answer: who is the client, what do they want, how valuable are they, who owns them, and what happens next?

4. **SaaS buyers need proof**  
   Dashboard, billing, analytics, and settings should expose health, usage, configuration completeness, and business outcomes.

5. **Mobile is a working surface**  
   Sales executives may use the product on phones. Tables must degrade into cards or stacked rows at small widths.

---

## Aesthetic Direction

**Direction:** Refined Enterprise Real Estate  
**Mood:** Calm, expensive, precise, and operationally alive.  
**Layout:** Grid-disciplined admin UI, more editorial public website.  
**Decoration:** Intentional, not ornamental. Use gradients, shadows, and imagery sparingly to create depth.

**Avoid**

- Purple AI gradients.
- Generic SaaS blobs.
- Uniform flat cards everywhere.
- Centered marketing sections with no real estate proof.
- Placeholder-only forms.

---

## Design Tokens

### Color

Use a warm neutral base with teal as the product anchor and gold as the premium accent.

```css
:root {
  --reos-bg: #f8faf8;
  --reos-surface: #ffffff;
  --reos-surface-muted: #f1f5f3;
  --reos-ink: #0f172a;
  --reos-ink-muted: #64748b;
  --reos-border: #dbe4df;

  --reos-primary: #0f766e;
  --reos-primary-strong: #115e59;
  --reos-primary-soft: #ccfbf1;

  --reos-gold: #b7791f;
  --reos-gold-soft: #fef3c7;

  --reos-success: #047857;
  --reos-warning: #d97706;
  --reos-danger: #be123c;
  --reos-info: #2563eb;
}
```

### Semantic Usage

- **Primary teal:** navigation active states, primary CTA, trusted links.
- **Gold:** premium plan, high-value property, revenue highlight, executive emphasis.
- **Success green:** won deals, active subscriptions, paid invoices, published listings.
- **Warning amber:** overdue followups, pending invoices, trial expiry, hot leads.
- **Danger rose:** failed payments, lost leads, suspended tenant, destructive actions.
- **Info blue:** system information, public analytics, configuration tips.

### Chart Palette

Use consistent chart colors in this order:

1. `#0f766e` teal
2. `#2563eb` blue
3. `#b7791f` gold
4. `#047857` green
5. `#d97706` amber
6. `#be123c` rose
7. `#7c3aed` violet, only when six colors are already used

---

## Typography

Current implementation uses default sans fonts. For the next production pass, use:

- **Display:** `Satoshi` or `General Sans`
- **Body/UI:** `Plus Jakarta Sans` or `Geist`
- **Data:** `Geist` with `tabular-nums`
- **Fallback:** `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

### Scale

- Display hero: `48px / 56px`, weight 700
- Page H1: `30px / 38px`, weight 700
- Section H2: `20px / 28px`, weight 700
- Card title: `15px / 22px`, weight 650
- Body: `14px / 22px`, weight 400
- Caption: `12px / 16px`, weight 500
- Data number: `28px / 34px`, weight 700, `tabular-nums`

---

## Spacing

Use an 8px grid. Smaller 4px increments are allowed only inside compact controls.

| Token | px | Usage |
|---|---:|---|
| `space-1` | 4 | Icon/text gaps |
| `space-2` | 8 | Compact row gaps |
| `space-3` | 12 | Form control internal rhythm |
| `space-4` | 16 | Card padding mobile, grid gaps |
| `space-6` | 24 | Card padding desktop, section gaps |
| `space-8` | 32 | Page section rhythm |
| `space-10` | 40 | Major dashboard regions |
| `space-12` | 48 | Public page sections |
| `space-16` | 64 | Public hero/section spacing |

---

## Radius and Shadow

Radius should communicate hierarchy.

- Inputs/buttons: `10px`
- Small cards/badges: `12px`
- Primary cards: `16px`
- Hero/public cards: `24px`
- Pills: `9999px`

Shadows should be soft and rare.

- Card default: `0 1px 2px rgba(15, 23, 42, 0.06)`
- Raised card: `0 18px 45px rgba(15, 23, 42, 0.10)`
- Premium/public card: `0 24px 60px rgba(15, 23, 42, 0.14)`

---

## Component Standards

### Page Header

Every admin page should start with:

- Eyebrow or module label when useful.
- H1.
- One-sentence business context.
- Primary action on the right.
- Optional secondary actions.
- Optional summary chips for status/counts.

### Cards

Use cards for decision areas, not every block.

- KPI cards need label, value, delta/hint, and optional semantic tone.
- Chart cards need title, subtitle, action slot, loading state, empty state.
- Property cards need image, price, locality, type/category, status, and CTA.
- CRM cards need client, budget, source, stage, assignee, temperature, next followup.

### Buttons

- One primary action per screen.
- Secondary buttons use border or muted background.
- Destructive buttons are rose and require clear copy.
- Focus states must use visible rings.

### Forms

- Labels are always visible.
- Placeholder text is a hint, not a label.
- Use helper text for Indian formats: phone `+91`, INR, lakh/crore.
- Validation should be inline and close to the field.
- Long filters should collapse into a filter panel on mobile.

### Tables

Tables are for dense comparison. They need:

- Sticky or visually distinct header.
- Row hover.
- Clear empty state.
- Status badges with text.
- Card alternative below `640px`.
- No raw UUIDs unless needed by an operator.

### Empty States

Every empty state should contain:

- What is empty.
- Why it matters.
- Primary next action if permission allows.
- Secondary help text if not.

Examples:

- Properties: "Add 5 demo-ready listings to activate your website and CRM matching."
- CRM: "New inquiries will appear here from website forms, chat, and manual entry."
- Billing: "Choose a plan to unlock quota tracking and invoices."

### Loading States

Use skeletons, not "Loading..." text, for primary screens.

- KPI skeleton row.
- Chart skeleton blocks.
- Table/card skeleton rows.
- Chat thread shimmer for messages.

### Error States

Use alert cards with:

- Short title.
- Plain-language message.
- Retry action when possible.
- No stack traces.

---

## Module Patterns

### Dashboard

Required sections:

- Hero summary with range selector.
- Revenue, lead, property, and conversion KPIs.
- Lead funnel.
- Lead source quality.
- Property inventory status.
- Monthly conversion.
- Recent leads.
- Recent conversations.
- Upcoming followups.
- Team performance.
- Quick actions.

### Properties

Required sections:

- Search/filter header.
- Card grid for visual browsing.
- Optional table for operations.
- Media-first detail page.
- Gallery or hero image.
- Amenities, tags, locality, and nearby-area notes.
- Status badge with reason/context.

### CRM

Required sections:

- Lead profile summary.
- Lead score / temperature.
- Stage timeline.
- Activity feed.
- Followups.
- Assignments.
- Related property matches.
- Notes.

### Chat

Required sections:

- Conversation filters.
- Unread counts.
- Client/property context.
- Message grouping by sender/time.
- Typing indicator.
- Attachment previews.
- Assignment and convert-to-inquiry actions.

### Analytics

Required sections:

- Executive KPIs.
- Trend deltas.
- Funnel conversion.
- Source quality.
- Revenue widgets.
- Leaderboard.
- Date range controls.

### Billing

Required sections:

- Current plan.
- Trial/renewal state.
- Usage meters.
- Invoice table.
- Plan comparison.
- Upgrade CTA.
- Past-due/suspended warning states.

### Settings

Group settings into:

- Brand and website.
- SEO and growth.
- Platform configuration.
- Domains and white label.
- Security and audit.
- Notifications and personal profile.

### Public Website

Required sections:

- Luxury hero search.
- Featured properties.
- Area insights.
- Testimonials.
- Trust proof.
- Inquiry widgets.
- Modern footer.
- Sticky mobile CTA on property pages.

---

## Responsive Rules

### 320px

- No fixed sidebar.
- Tables become cards.
- Chat list and thread become separate views.
- Primary action remains visible.
- Public property detail gets sticky bottom CTA.

### 768px

- Sidebar may be compact or drawer.
- Two-column cards allowed.
- Filters may remain visible if under two rows.

### 1024px

- Full admin shell.
- Dashboard can use two-column charts.
- Properties can use card grid plus table.

### 1440px

- Use `max-w-7xl` for admin content.
- Avoid over-wide tables without useful density.
- Public pages can use richer editorial layouts.

---

## Accessibility Rules

- WCAG 2.1 AA contrast target.
- Keyboard reachable navigation, filters, modals, chat composer, and dropdowns.
- Visible `focus-visible` rings.
- `aria-label` for icon-only buttons.
- Status text must not rely on color alone.
- Form controls require labels.
- Error messages must be programmatically associated with inputs when possible.

---

## Demo Data Presentation Rules

Demo data should look like a real Gujarat real estate business.

Use:

- Cities: Ahmedabad, Surat, Vadodara, Rajkot, Gandhinagar.
- Localities: SG Highway, South Bopal, Science City, Prahlad Nagar, Satellite, Bopal, Thaltej.
- Property types: luxury villas, apartments, plots, commercial offices, shops, warehouses.
- Indian names, `+91` phone numbers, INR budgets, realistic lakh/crore pricing.
- Lead sources: Website, Property Portal, WhatsApp, Facebook, Google Ads, Referral, Walk-in.
- Rich activity histories: inquiry created, assigned, note added, followup scheduled, site visit completed, stage changed.

Do not seed fantasy data. Demo buyers should recognize the market.

---

## Implementation Notes

- Keep business logic in backend services and repositories. UI polish should not bypass tenant isolation or RBAC.
- Do not add new backend business features for this transformation.
- Prefer shared frontend primitives before repeating Tailwind classes across pages.
- Expand seed data using existing schema and public APIs/models.
- Preserve existing `docs/UI_UX_GUIDELINES.md` as baseline; this file supersedes it for premium polish decisions.

---

## Definition of Premium

RE-OS looks demo-ready when a fresh install has:

- A populated dashboard.
- Property inventory with images and status.
- CRM leads across stages.
- Chat conversations with believable messages.
- Billing plan, subscription, usage, and invoices.
- Notifications and audit activity.
- Public website listings with realistic locality content.
- No blank screens in the happy-path demo.
- No mobile layout overflow on critical pages.
