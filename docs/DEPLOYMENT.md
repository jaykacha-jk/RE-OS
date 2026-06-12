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

- File: `backend/Dockerfile`
- Build context: repository root
- Stage 1: `npm ci`, `prisma generate`, Nest build, prune dev dependencies
- Stage 2: production Node runtime, non-root `node` user, `/health` Docker healthcheck
- Runtime command: `node backend/dist/main.js`
- Release migration command: `npm --workspace backend run prisma:migrate:deploy`

```bash
docker build -f backend/Dockerfile -t re-os-backend:staging .
```

### 4.2 Frontend Dockerfile

- File: `frontend/Dockerfile`
- Build context: repository root
- Uses Next.js `output: 'standalone'`
- Non-root `node` runtime
- Runtime command: `node frontend/server.js`

```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://staging-api.reos.app \
  -t re-os-frontend:staging .
```

### 4.3 Staging Compose (`docker-compose.staging.yml`)

Services: `postgres`, `redis`, `migrate`, `api`, `frontend`.

```bash
cp .env.example .env
# Fill required secrets before starting: POSTGRES_PASSWORD, JWT keys, email/payment secrets.
docker compose -f docker-compose.staging.yml up --build
```

The `migrate` service runs Prisma migrations once after Postgres is healthy. The API waits for Postgres, Redis, and the migration step before serving traffic.

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
3. live Postgres tenant-isolation e2e
4. build application artifacts
5. build docker images
6. broader API integration tests (auth, properties, CRM, billing webhook) [pending]
7. push to ECR [pending]
8. deploy staging (auto on main) [pending]
9. deploy production (manual approval) [pending]
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

| Component | Tool | Status |
|-----------|------|--------|
| Error tracking | Sentry (`@sentry/node`) | **Implemented** — set `SENTRY_DSN` to enable; 5xx faults forwarded with request context. Safe no-op when unset. |
| Structured logs | Newline-delimited JSON to stdout | **Implemented** — set `LOG_FORMAT=json`. Each request logs method/url/status/duration/`request_id`/tenant. |
| Request correlation | `x-request-id` header | **Implemented** — generated/propagated per request; echoed in responses and embedded in every error body (`error.request_id`). |
| Log shipping | Loki / CloudWatch Logs / Datadog | Tail container stdout (JSON) with the platform's log driver/agent. |
| Metrics | Prometheus sidecar / ADOT → AMP | Planned |
| Dashboards | Grafana | Planned |
| Uptime | Route53 health checks + external ping (`/health`) | Planned |

**App configuration:**

| Variable | Purpose | Default |
|----------|---------|---------|
| `LOG_FORMAT` | `json` for structured stdout logs (use outside dev); anything else = human-readable | `text` |
| `SENTRY_DSN` | Enables Sentry error tracking when set | empty (disabled) |
| `SENTRY_TRACES_SAMPLE_RATE` | Performance trace sampling (0–1) | `0` |
| `APP_RELEASE` | Release/version tag attached to Sentry events | unset |

**Alerts:** API 5xx > 1%, p95 latency > 1s, queue depth > 10k, RDS CPU > 80%.

---

## 9. Backup & DR

| Asset | Backup | Status |
|-------|--------|--------|
| Postgres (app-level) | `scripts/db-backup.sh` — `pg_dump -Fc`, integrity-checked, retention-pruned, optional S3 mirror; compose `backup` service | **Implemented** — see `docs/BACKUP_RUNBOOK.md` |
| Postgres (infra) | RDS automated daily, 7-day retention, PITR | Planned (enable on managed DB) |
| S3 | Versioning enabled | Planned |
| Redis | AOF persistence (`--appendonly yes` in compose); snapshot daily | Partial |

Restore is via `scripts/db-restore.sh` (guarded by `CONFIRM_RESTORE=yes`). Run a
**quarterly restore drill** per the runbook to validate RTO.

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
