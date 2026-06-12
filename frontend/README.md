# RE-OS Frontend

Next.js App Router application. **No application code yet** — scaffold only.

## Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── forgot-password/
│   ├── (admin)/
│   │   ├── dashboard/
│   │   ├── properties/
│   │   ├── inquiries/
│   │   ├── employees/
│   │   ├── ai-calls/
│   │   ├── chat/
│   │   ├── reports/
│   │   └── settings/
│   ├── (public)/
│   │   ├── buy/[city]/[slug]/
│   │   └── rent/[city]/[slug]/
│   ├── platform/               # Super Admin
│   ├── layout.tsx
│   └── globals.css
├── components/
│   └── ui/                     # shadcn
├── features/
│   ├── auth/
│   ├── properties/
│   ├── crm/
│   ├── employees/
│   ├── dashboard/
│   ├── chat/
│   ├── billing/
│   └── ai-calls/
├── hooks/
├── services/
│   └── api/
├── types/
├── lib/
├── public/
├── Dockerfile
└── package.json                # Phase 1
```

## Conventions

- Server Components for public SEO pages
- TanStack Query for admin client data
- Feature folders colocate components, hooks, API calls
- See `docs/UI_UX_GUIDELINES.md`, `.cursor/rules/frontend.mdc`

## Start Implementation

Begin with **Phase 1** auth + admin shell in `docs/MVP_ROADMAP.md`.
