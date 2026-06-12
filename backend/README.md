# RE-OS Backend

NestJS modular monolith with Phase 1 foundation in progress (health, auth scaffold, Swagger).

## Structure

```
backend/
├── src/
│   ├── main.ts                 # Bootstrap (Phase 1)
│   ├── app.module.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── tenant/
│   │   ├── users/
│   │   ├── rbac/
│   │   ├── employees/
│   │   ├── properties/
│   │   ├── crm/
│   │   ├── search/
│   │   ├── notifications/
│   │   ├── chat/
│   │   ├── billing/
│   │   ├── ai-agent/
│   │   ├── analytics/
│   │   ├── audit/
│   │   └── platform/
│   ├── common/
│   │   ├── guards/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   ├── context/
│   │   └── database/
│   ├── config/
│   ├── database/
│   │   └── migrations/
│   ├── events/
│   ├── jobs/
│   │   ├── processors/
│   │   └── queues/
│   └── providers/
├── test/
├── Dockerfile
├── package.json              # Phase 1
└── tsconfig.json
```

## Module Template (each module)

```
modules/{name}/
├── {name}.module.ts
├── {name}.controller.ts
├── {name}.service.ts
├── {name}.repository.ts
├── dto/
├── entities/
├── mappers/
├── events/
└── __tests__/
```

## Documentation

See `docs/SYSTEM_DESIGN.md`, `docs/CODING_STANDARDS.md`, `.cursor/rules/backend.mdc`.

## Local Setup

1. Start dependencies from repo root:
   - `docker compose up -d`
2. Copy env file:
   - `cp ../.env.example ../.env`
3. Generate Prisma client:
   - `npm run prisma:generate`
4. Run migrations:
   - `npm run prisma:migrate:dev`
5. Seed system data:
   - `npm run prisma:seed`
6. Start backend:
   - `npm run start:dev`
