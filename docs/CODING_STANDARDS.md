# RE-OS Coding Standards

**Version:** 1.0

---

## 1. General

- **Language:** TypeScript strict mode everywhere  
- **Node:** LTS 20+  
- **Package manager:** pnpm (monorepo root)  
- **Formatting:** Prettier; ESLint recommended rules  
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`)  

---

## 2. Backend (NestJS)

### 2.1 Structure

```
src/modules/{module}/
  {module}.module.ts
  {module}.controller.ts
  {module}.service.ts
  {module}.repository.ts
  dto/
  entities/
  mappers/
  events/
  __tests__/
```

### 2.2 Rules

- Controllers: HTTP only; no business logic  
- Services: transactions, domain rules, emit events  
- Repositories: all DB access; extend `TenantAwareRepository`  
- DTOs: class-validator decorators; separate Create/Update/Response  
- Never return raw entities — use response DTOs/mappers  

### 2.3 Naming

| Item | Convention |
|------|------------|
| Files | kebab-case |
| Classes | PascalCase |
| Methods | camelCase |
| DB columns | snake_case |
| Permissions | dot.notation |

### 2.4 Errors

- Use domain exceptions mapped to HTTP in filter  
- Never expose stack traces in production  

---

## 3. Frontend (Next.js)

### 3.1 Structure

```
features/{feature}/
  components/
  hooks/
  api/
  types/
app/(admin)/...
app/(public)/...
components/ui/   # shadcn
```

### 3.2 Rules

- Server Components default; `'use client'` only when needed  
- Data fetching: TanStack Query in client; server fetch in RSC for SEO pages  
- Forms: React Hook Form + Zod resolver  
- No direct `fetch` in components — use service layer  
- Env: `NEXT_PUBLIC_*` only for public values  

---

## 4. Database

- Migrations version controlled; never edit applied migrations  
- All business tables include standard audit columns  
- Indexes on foreign keys and `(tenant_id, ...)` query patterns  
- Use UUIDs; never serial IDs in API  

---

## 5. API

- REST JSON; OpenAPI generated  
- Version prefix `/api/v1`  
- Pagination on all list endpoints  
- Consistent error envelope (see API_SPEC.md)  

---

## 6. Testing

| Type | Tool | Coverage |
|------|------|----------|
| Unit | Jest | Services, utils |
| Integration | Jest + testcontainers | Repositories, API |
| E2E | Playwright | Critical flows |

**Critical modules 80%+:** auth, property, crm, billing  

**Required tests per feature:**

- Tenant isolation negative test  
- RBAC forbidden test  
- Happy path + validation errors  

---

## 7. Security in Code

- No secrets in repo  
- Sanitize user HTML (chat) with DOMPurify  
- Parameterized queries only  
- Rate limit public routes  

---

## 8. Git & PR

- PR description: what, why, test plan  
- Max ~400 lines per PR preferred  
- Docs update in same PR when schema/API changes  

---

## 9. Comments

- Explain **why**, not what  
- No commented-out code in main  

---

## 10. Anti-Patterns

- God services >500 lines — split by subdomain  
- Business logic in controllers or React components  
- `any` type without explicit justification  
- Cross-module direct repository imports — use events or public service interface  

---

*Architecture: [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md). Cursor rules: `.cursor/rules/`.*
