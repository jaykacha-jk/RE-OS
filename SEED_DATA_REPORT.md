# Seed Data Expansion Report

**Date:** 2026-06-12
**File audited/changed:** `backend/prisma/seed.js`
**Status:** COMPLETE — all targets met or exceeded (verified by live DB counts).

---

## Summary

The previous demo data was thin (1 image per property, 3 messages per
conversation, 3 invoices per org, ~30-day analytics window, no CRM notes, no
property history). The seed was expanded so every module — dashboard,
analytics, CRM, properties, billing, chat, notifications, and the public
website — renders with realistic volume across **5 organizations**.

---

## Demo Data Counts (verified from the database after seeding)

| Entity | Target | Actual | Status |
|--------|-------:|-------:|:------:|
| Organizations | 5 | **5** | ✅ |
| Employees | 50 | **52** | ✅ |
| Users (incl. super admin + owners) | — | 53 | ✅ |
| Properties | 500 | **500** | ✅ |
| Published Properties | 200 | **255** | ✅ |
| Property Images (≥5 per property) | 5×500 | **3000** (6/property) | ✅ |
| Property Amenities | — | 1995 | ✅ |
| Property Tags | — | 2000 | ✅ |
| Property Assignments | — | 500 | ✅ |
| Property History | — | **1500** (3/property) | ✅ |
| Inquiries | 300 | **300** | ✅ |
| Pipeline Entries (inquiry `stage`) | 300 | **300** | ✅ |
| CRM Activities | — | **900** (3/inquiry) | ✅ |
| Followups | — | **300** (1/inquiry) | ✅ |
| Notes (`inquiry_notes`) | — | **600** (2/inquiry) | ✅ |
| Site Visits | 50 | **100** | ✅ |
| Conversations | 100 | **100** | ✅ |
| Messages | 1000 | **1000** (10/conversation) | ✅ |
| Notifications | 200 | **200** (40/org) | ✅ |
| Invoices | 100 | **100** (20/org) | ✅ |
| Subscriptions | 5 | **5** (1/org) | ✅ |
| Analytics (12 months) | 12 mo | **360 events across 13 distinct months** | ✅ |

> **Pipeline Entries:** This codebase deliberately models the CRM pipeline as a
> `stage` string column on `inquiries` (see `schema.prisma` — *"Pipeline stage
> column kept as a String union instead of a pipeline_stages table"*), not a
> separate table. Each of the 300 inquiries carries a pipeline stage across the
> full 9-stage funnel (NEW → … → CLOSED_WON / CLOSED_LOST), so 300 inquiries =
> 300 pipeline entries.

---

## Changes Applied to `backend/prisma/seed.js`

1. **Property images: 1 → 6 per property** (`seedDemoProperties`)
   Replaced the single cover-image `create` with a `createMany` generating 6
   gallery images per property (first is `is_cover`), satisfying the ≥5
   requirement → 3,000 images.

2. **Property history added** (`seedDemoProperties`)
   New `property_history.createMany` writes a 3-event timeline per property
   (`created` → `price_changed` → `status_changed`) → 1,500 rows.

3. **CRM notes added** (`seedDemoInquiries`)
   New `inquiry_notes.createMany` writes 2 sales notes per inquiry (budget
   confirmation + WhatsApp shortlist) → 600 rows.

4. **Chat messages: 3 → 10 per conversation** (`seedDemoConversations`)
   Generates a realistic 10-message alternating client/agent thread per
   conversation → 1,000 messages.

5. **Invoices: 3 → 20 per org** (`seedDemoBilling`)
   20 monthly invoices per org (~20 months of billing history) → 100 invoices.

6. **Notifications: 20 → 40 per org** (`seedDemoNotificationsAndAnalytics`)
   Five notification archetypes (CRM / billing / system) → 200 notifications.

7. **Analytics spread across 12 months** (`seedDemoNotificationsAndAnalytics`)
   Public analytics events now span the last ~360 days (≈72 events/org) instead
   of 30 days, so monthly analytics rollups are populated → 360 events over 13
   calendar months.

Existing data (lead sources, tenant settings, AI prompts/knowledge/agents,
subscriptions, amenities, tags, assignments, activities, followups, site
visits) was preserved.

---

## Validation Pipeline (all green)

| Step | Command | Result |
|------|---------|--------|
| Build backend | `npm run build:backend` | exit 0 |
| Migrations | `prisma migrate deploy` | no pending migrations |
| Seed | `node prisma/seed.js` | "Seed completed" |
| Verify counts | (count query) | all targets met (table above) |
| Build frontend | `npm run build:frontend` | exit 0 (50 routes) |

---

## Final Verification — module population

- **Dashboard / Analytics:** 500 properties + 300 inquiries + 360 analytics
  events over 13 months → KPIs, funnel, sources, monthly conversion all populated.
- **CRM:** 300 inquiries across the full pipeline, 900 activities, 600 notes,
  300 followups, 100 site visits.
- **Properties:** 500 listings (255 published), 6 images each, amenities, tags,
  assignments, and history timelines.
- **Billing:** 5 subscriptions + 100 invoices (paid/open mix).
- **Chat:** 100 conversations × 10 messages = 1,000 messages.
- **Notifications:** 200 across users/orgs (read + unread mix).
- **Public website:** 255 published, public listings + analytics events for SEO/traffic views.
