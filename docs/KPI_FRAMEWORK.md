# RE-OS KPI Framework

**Version:** 1.0

---

## 1. North Star Metric

**Qualified pipeline value closed per tenant per month** (INR)

Proxy for MVP: **Inquiries reaching "Site Visit Scheduled" or beyond per week**

---

## 2. SaaS Metrics

| KPI | Formula | Target (Month 12) |
|-----|---------|-------------------|
| MRR | Sum active subscriptions | ₹40L |
| ARR | MRR × 12 | ₹4.8Cr |
| Churn (logo) | Lost orgs / start orgs | <3%/month |
| NRR | (MRR + expansion - churn) / start MRR | >100% |
| Trial conversion | Paid / trials ended | 25% |
| CAC | Sales+marketing spend / new paid | <₹40k |
| LTV | ARPU × avg lifetime months | ₹4L+ |

---

## 3. Product Metrics (Per Tenant)

| KPI | Definition |
|-----|------------|
| Activation rate | Orgs with 5+ properties & 2+ employees in 7d |
| Inquiry velocity | New inquiries / week |
| SLA compliance | Follow-ups completed before due / total |
| Conversion rate | Closed Won / total inquiries (rolling 90d) |
| Time to first contact | Median minutes inquiry → first activity |
| Property publish rate | Public listings / total properties |

---

## 4. Module KPIs

### CRM

- Lead response time < 15 min (business hours)  
- Pipeline stage aging alerts  

### Property

- % listings with ≥5 photos  
- Search CTR on public site  

### AI Agent

- Calls with confidence ≥0.8 extraction rate  
- Cost per qualified lead  

### SEO

- Indexed pages per tenant  
- Organic sessions / property page  

---

## 5. Dashboard Mapping

| Widget | KPI | Roles |
|--------|-----|-------|
| New inquiries 24h | Inquiry velocity | Manager+ |
| Conversion % | Conversion rate | Owner, Manager |
| Pipeline value | North star proxy | Owner |
| Overdue follow-ups | SLA compliance | Manager, Executive |
| Active properties | Inventory health | Admin, Marketing |

---

## 6. Reporting Cadence

| Report | Audience | Frequency |
|--------|----------|-----------|
| Executive summary | CEO/Founders | Weekly |
| Tenant health | CS/Success | Weekly |
| Product funnel | Product | Daily (automated) |
| Infrastructure | Engineering | Real-time dashboards |

---

*Implementation: Phase 4 analytics. Growth: [GROWTH_STRATEGY.md](./GROWTH_STRATEGY.md).*
