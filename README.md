# Real Estate Operating System (RE-OS)

Multi-tenant SaaS platform for real estate agencies — property inventory, CRM pipeline, assistant automation, live chat, analytics, and billing.

## Status

Active development. Backend Admin API is ~88% complete and the platform includes assistant automation: deterministic lead scoring, property matching, follow-up suggestions, conversation intelligence, and LLM/RAG chat when `OPENAI_API_KEY` is configured. Voice calling is mock/demo-only until a real Exotel or Twilio provider is wired. Admin UI ~64% and public web ~67%. See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) for the live breakdown.

## Documentation (`docs/`)

| Document | Description |
|----------|-------------|
| [PLAN.md](docs/PLAN.md) | Master program plan |
| [PRD.md](docs/PRD.md) | Product requirements |
| [SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) | Architecture |
| [DB_SCHEMA.md](docs/DB_SCHEMA.md) | Database schema |
| [API_SPEC.md](docs/API_SPEC.md) | REST API |
| [RBAC.md](docs/RBAC.md) | Access control |
| [MVP_ROADMAP.md](docs/MVP_ROADMAP.md) | 9-phase roadmap |
| [AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md) | Assistant automation architecture |
| [SECURITY.md](docs/SECURITY.md) | Security |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Infrastructure |
| [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) | Current build status |

## Cursor AI

- **Rules:** `.cursor/rules/*.mdc` (16 files)
- **Skills:** `.cursor/skills/*.md` (10 domain skills)

## Repository Layout

```
docs/           # Source of truth
backend/        # NestJS API (auth, properties, CRM, billing, AI, chat, analytics)
frontend/       # Next.js (admin + public web)
.cursor/        # AI rules & skills
docker-compose.yml  # Local Postgres + Redis
```

## Tech Stack

Next.js · NestJS · PostgreSQL · Prisma · Redis · BullMQ · Socket.IO · Razorpay · OpenAI

## Ports

| Service | URL | Configured by |
|---------|-----|---------------|
| Backend API | `http://localhost:4545` | `PORT` in `.env` (code default `3001`) |
| Frontend | `http://localhost:3000` | `next dev -p 3000` |
| Swagger docs | `http://localhost:4545/api/v1/docs` | — |
| Health check | `http://localhost:4545/health` | — |

## Local Setup

1. Start infrastructure:
   - `docker compose up -d`
2. Copy env:
   - `cp .env.example .env` (this repo's `.env` runs the backend on `PORT=4545`)
3. Generate Prisma client:
   - `npm --workspace backend run prisma:generate`
4. Generate dev JWT keys:
   - `npm --workspace backend run keys:generate`
5. Apply migrations (after Postgres is running):
   - `npm --workspace backend run prisma:migrate:deploy`
6. Seed base data (roles, permissions, plans, super admin, demo data):
   - `npm --workspace backend run prisma:seed`
7. Point the frontend at the API — create `frontend/.env.local`:
   - `NEXT_PUBLIC_API_URL=http://localhost:4545`

> **Note:** BullMQ requires Redis **≥ 5.0.0**. An older local Redis (e.g. the legacy 3.x Windows build) lets the HTTP API boot but logs repeated queue connection errors. Use the `docker compose` Redis (or Redis ≥ 5) to enable background jobs.

## Production Requirements

- Configure Redis for BullMQ queues and cache-backed services; in-memory fallbacks are for local development only.
- Set `CHAT_CLIENT_TOKEN_SECRET` (or `JWT_PRIVATE_KEY`) before enabling the public chat token helpers in production.
- Use managed secrets for production credentials such as Resend, Razorpay, JWT keys, and database URLs.

## Running the Apps

Run each in its own terminal from the repo root:

```bash
# Backend (NestJS, watch mode) -> http://localhost:4545
npm run dev:backend

# Frontend (Next.js) -> http://localhost:3000
npm run dev:frontend
```

Other useful scripts:

```bash
npm run build:backend    # nest build
npm run build:frontend   # next build
npm test                 # run workspace tests
```

## Dev Logins (after seed)

- Super Admin: `super@reos.dev` / `ChangeMe123!` (no tenant slug)
- Demo org owner: `owner@demo.realty` / `ChangeMe123!` (tenant slug: `demo`)
