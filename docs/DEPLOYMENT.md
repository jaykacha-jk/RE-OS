# RE-OS Deployment & Infrastructure

**Version:** 1.0  
**Region:** AWS ap-south-1 (Mumbai)  
**Last Updated:** 2026-06-05

---

## 1. Environment Topology

| Environment | Purpose | URL pattern |
|-------------|---------|-------------|
| `local` | Developer machines | localhost |
| `dev` | Integration testing | dev-api.reos.app |
| `staging` | Pre-prod QA | staging-api.reos.app |
| `production` | Live | api.reos.app |

---

## 2. Architecture (Production)

```
Route53 → CloudFront (frontend + static) 
       → ALB (API) → ECS Fargate (api, worker)
                    → RDS PostgreSQL (Multi-AZ)
                    → ElastiCache Redis
                    → OpenSearch/Elasticsearch
                    → S3 + KMS
```

---

## 3. ECS Services

| Service | Image | CPU/Mem | Count (prod start) |
|---------|-------|---------|-------------------|
| `reos-api` | backend Dockerfile | 1 vCPU / 2GB | 2–4 auto-scale |
| `reos-worker` | same image, worker CMD | 1 vCPU / 2GB | 2 |
| `reos-frontend` | Next.js standalone | 0.5 vCPU / 1GB | 2 |

**Health check:** `GET /health` every 30s.

---

## 4. Docker

### 4.1 Backend Dockerfile (multi-stage)

- Stage 1: `npm ci` + build  
- Stage 2: distroless/node production, non-root user  
- `NODE_ENV=production`  

### 4.2 Frontend Dockerfile

- Next.js `output: 'standalone'`  
- Non-root user  

### 4.3 Local Compose (`docker-compose.yml`)

Services: `postgres`, `redis`, `elasticsearch`, `api`, `worker`, `frontend` (dev only).

---

## 5. Database Migrations

- Tool: Prisma migrate or TypeORM migrations  
- **Rule:** migrations run in CI before deploy; backward-compatible expand-only in prod  
- Rollback: forward-fix preferred; down migrations only in dev  

---

## 6. CI/CD (GitHub Actions)

```yaml
# Pipeline stages
1. lint + typecheck (frontend, backend)
2. unit tests
3. integration tests (testcontainers postgres/redis)
4. build docker images
5. push to ECR
6. deploy staging (auto on main)
7. deploy production (manual approval)
```

**Branch protection:** main requires PR + 1 review + green CI.

---

## 7. Environment Variables

| Variable | Service | Secret |
|----------|---------|--------|
| `DATABASE_URL` | api, worker | yes |
| `REDIS_URL` | api, worker | yes |
| `JWT_PRIVATE_KEY` | api | yes |
| `JWT_PUBLIC_KEY` | api | yes |
| `AWS_S3_BUCKET` | api, worker | no |
| `AWS_REGION` | all | no |
| `ELASTICSEARCH_URL` | api, worker | yes |
| `OPENAI_API_KEY` | worker | yes |
| `RAZORPAY_KEY_ID` | api | yes |
| `RAZORPAY_KEY_SECRET` | api | yes |
| `RAZORPAY_WEBHOOK_SECRET` | api | yes |
| `SENTRY_DSN` | all | yes |

Secrets sourced from AWS Secrets Manager; injected via ECS task definition.

---

## 8. Monitoring & Logging

| Component | Tool |
|-----------|------|
| Metrics | Prometheus sidecar / ADOT → AMP |
| Dashboards | Grafana |
| Logs | Loki or CloudWatch Logs → Grafana |
| APM/Errors | Sentry |
| Uptime | Route53 health checks + external ping |

**Alerts:** API 5xx > 1%, p95 latency > 1s, queue depth > 10k, RDS CPU > 80%.

---

## 9. Backup & DR

| Asset | Backup |
|-------|--------|
| RDS | Automated daily, 7-day retention, PITR |
| S3 | Versioning enabled |
| Redis | AOF persistence; snapshot daily |

**RTO:** 4 hours | **RPO:** 1 hour

---

## 10. CDN & Static Assets

- CloudFront distribution for `*.reos.app` tenant subdomains  
- Cache property images `max-age=86400`  
- API not cached  

---

## 11. SSL/TLS

- ACM certificates for `reos.app`, `*.reos.app`  
- Custom domains (Phase 9): per-tenant ACM via DNS validation  

---

## 12. Deployment Checklist

- [ ] Migrations applied  
- [ ] Secrets rotated if compromised  
- [ ] Feature flags default verified  
- [ ] Smoke test: login, create property, create inquiry  
- [ ] Canary 10% traffic 15 min (production)  
- [ ] Rollback image tag documented  

---

*Security controls: [SECURITY.md](./SECURITY.md).*
