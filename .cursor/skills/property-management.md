# Property Management — Agent Skill

## Domain Knowledge

Properties are tenant inventory for buy/rent residential/commercial listings. Public listings drive SEO; internal fields include assignments, tags, amenities, media.

**Status flow:** draft → available → reserved → sold/rented → archived

## Business Workflow

1. Admin/Marketing creates property (draft)
2. Upload media via presigned S3 URLs
3. Assign agents (primary + secondary)
4. Publish: set is_public=true, status=available → ES index + ISR revalidate
5. Inquiry links to property; on sold → unpublish from search
6. Bulk CSV import async job with row-level errors

## Entity Relationships

```
properties 1──* property_media
properties *──* employees (property_assignments)
properties *──* inquiries (inquiry_properties)
properties ── indexed in Elasticsearch
```

## Validation Rules

- BR-P01 slug unique per tenant
- BR-P02 public requires available + is_public + ≥1 image
- BR-P03 sold removes from ES <60s
- BR-P04 price >= 0
- BR-P05 CSV max 500 rows
- BR-P06 one primary agent
- BR-P07 archived blocks new inquiries

## Common Edge Cases

- Publish without images → 422
- Slug conflict on title auto-generate → append suffix `-2`
- Executive edits property not assigned → 403
- Soft delete property with active inquiries → warn or block per policy

## API Considerations

- `POST /properties/:id/media/presign` before upload
- `GET /properties/search` hits Elasticsearch with mandatory tenant filter
- Public routes strip internal_notes, commission fields
- Filter params: city, area, bhk, price range, status, type

## Database Considerations

- GIN index on amenities JSONB optional
- Partial unique slug index WHERE deleted_at IS NULL
- property_history or audit_logs for price changes
- Store lat/lng for geo search
