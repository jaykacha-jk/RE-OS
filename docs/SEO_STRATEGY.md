# RE-OS SEO Strategy

**Version:** 1.0  
**Market focus:** India real estate (city-first)

---

## 1. Goals

| Timeframe | Goal |
|-----------|------|
| 6 months | 50k organic sessions/month (aggregate tenants) |
| 12 months | Programmatic city/area pages ranking top 20 |
| Per tenant | Property pages index within 48h of publish |

---

## 2. Technical SEO

| Item | Implementation |
|------|----------------|
| SSR | Next.js App Router SSR for public property pages |
| ISR | Revalidate property pages every 300s; on-demand revalidate on publish |
| Sitemap | `/sitemap.xml` per tenant + index sitemap for platform |
| Robots | `/robots.txt` — disallow admin; allow public listings |
| Canonical | Self-referencing canonical on all public pages |
| Core Web Vitals | LCP <2.5s, CLS <0.1 (image dimensions, priority hero) |
| Mobile-first | Responsive; same URL |
| HTTPS | Enforced |

---

## 3. URL Structure

```
https://{tenant}.reos.app/buy/{city}/{property-slug}
https://{tenant}.reos.app/rent/{city}/{property-slug}
https://{tenant}.reos.app/commercial/{city}/{property-slug}
https://{tenant}.reos.app/buy/{city}                    (city hub)
https://{tenant}.reos.app/buy/{city}/{area}             (area hub)
https://{tenant}.reos.app/buy/{city}/3bhk-flats         (programmatic facet)
```

**Example:** `/buy/ahmedabad/3bhk-flat-sg-highway`

**Rules:**

- Lowercase, hyphen-separated  
- Max 220 chars slug  
- No UUIDs in public URLs  
- Legacy `/listings/{slug}?tenant={slug}` pages remain supported but canonicalize to the SEO route.
- Query-param tenant resolution is for local/dev fallback; production discovery should use tenant subdomains or custom domains.

---

## 4. On-Page SEO (Property)

| Element | Template |
|---------|----------|
| Title | `{BHK} {Category} in {Area}, {City} - ₹{Price} \| {OrgName}` |
| Meta description | `{Title}. {Area}, {City}. {BHK} BHK, {sqft} sqft. Amenities: {top3}. Contact now.` |
| H1 | Property title |
| Open Graph | og:title, og:description, og:image (hero), og:url |
| Twitter Card | summary_large_image |
| Schema.org | `RealEstateListing` + `Offer` + `Place` |

```json
{
  "@context": "https://schema.org",
  "@type": "RealEstateListing",
  "name": "3BHK Luxury Flat SG Highway",
  "offers": {
    "@type": "Offer",
    "price": "8500000",
    "priceCurrency": "INR"
  }
}
```

---

### 4.1 Lead Capture SEO Pages

Every property detail page should include a low-friction inquiry form. Submissions call `POST /api/v1/public/{tenant_slug}/inquiries` and create a CRM inquiry with `source_name = Website`. Public inquiry creation must:

- Link the inquiry to the public property using the tenant-scoped property slug.
- Keep BR-C01 duplicate detection active unless the platform later adds an explicit public duplicate UX.
- Store user agent/IP in audit metadata without logging secrets or sensitive IDs.
- Return a small public-safe success payload, not the full internal inquiry record.

---

## 5. Programmatic SEO

### 5.1 Page Types

| Type | Min listings to index | Content |
|------|----------------------|---------|
| City hub | 10 | Intro copy + listing grid + FAQ |
| Area hub | 5 | Area guide + listings |
| BHK + city | 5 | Filtered listing page |
| Builder page | 3 | Builder profile + listings |

### 5.2 Quality Gates (BR-S01)

- `is_indexable = false` until threshold met  
- Unique intro text ≥150 words (template + variables, not duplicate spam)  
- Internal links to related areas  

### 5.3 Sitemap Priority

| URL type | priority | changefreq |
|----------|----------|------------|
| Property | 0.8 | daily |
| Area | 0.6 | weekly |
| City | 0.7 | weekly |

---

## 6. Local SEO

- NAP consistency: org name, phone in footer  
- Google Business Profile link (tenant setting)  
- `areaServed` in Organization schema  

---

## 7. Performance for SEO

- WebP images + CDN  
- Lazy load below-fold images  
- Critical CSS inline for LCP image  

---

## 8. Analytics

- Google Search Console per tenant domain  
- Track impressions/clicks per city page  
- UTM on paid campaigns; organic via GSC  
- Track property detail views, inquiry conversion, and chat conversion as public website events once the analytics event pipeline exposes public-safe ingestion.

---

## 9. Anti-Patterns (Avoid)

- Thin doorway pages with no listings  
- Duplicate titles across tenants (tenant name in title fixes)  
- Indexing sold/archived listings  
- Cloaking different content for bots  

---

*Implementation: Phase 8 public website and SEO platform builds on the Phase 2 public listings foundation. Full custom-domain and large-scale area/facet generation remain Phase 9 scale work. UI: [UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md).*
