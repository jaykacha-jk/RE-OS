# RE-OS Security Specification

**Version:** 1.0  
**Last Updated:** 2026-06-05

---

## 1. Security Objectives

| Objective | Target |
|-----------|--------|
| Tenant isolation | Zero cross-tenant data leakage |
| Authentication | Strong credentials + short-lived tokens |
| Authorization | RBAC at API and field level |
| Data protection | Encryption in transit and at rest |
| Availability | DDoS mitigation via WAF + rate limits |
| Compliance readiness | India DPDP-aware practices, audit trail |

---

## 2. Authentication

### 2.1 JWT Access Tokens

| Claim | Description |
|-------|-------------|
| `sub` | user_id |
| `tid` | tenant_id (null super admin) |
| `roles` | array of role codes |
| `permissions` | optional expanded list |
| `iat`, `exp` | issued / expiry |
| `jti` | unique token id |

- **Algorithm:** RS256 (asymmetric; private key in secrets manager)  
- **TTL:** 15 minutes  
- **Storage (client):** memory or httpOnly cookie for web admin; never localStorage for sensitive deployments  

### 2.2 Refresh Tokens

- **TTL:** 7 days (30 days with "remember me")  
- **Rotation:** single-use; family detection revokes all on reuse attack  
- **Storage:** httpOnly Secure SameSite=Strict cookie + hash in DB  
- **Revocation:** logout, password change, admin suspend  

### 2.3 Password Security

- bcrypt cost factor 12 (adjust with hardware benchmarks)  
- Password history: last 5 hashes rejected  
- Breach check: optional Have I Been Pwned k-anonymity API  

### 2.4 MFA (Phase 9)

- TOTP for org_owner and super_admin  
- Enforced for platform admin  

---

## 3. Authorization

- NestJS `JwtAuthGuard` → `TenantGuard` → `PermissionsGuard`  
- Resource loaders verify `entity.tenant_id === jwt.tid`  
- Return **404** (not 403) on cross-tenant ID guess to prevent enumeration  
- Super Admin impersonation audited (see RBAC.md)  

---

## 4. Tenant Isolation

| Layer | Control |
|-------|---------|
| Middleware | Inject `TenantContext` from JWT/subdomain |
| Repository | Base class appends `tenant_id` filter |
| Elasticsearch | Mandatory `tenant_id` filter clause |
| S3 | Prefix `tenants/{tenant_id}/`; IAM scoped |
| Redis keys | Include tenant_id in key |
| Tests | CI suite `tenant-isolation.integration.spec.ts` |

---

## 5. Rate Limiting

| Endpoint class | Limit |
|----------------|-------|
| Login | 10/min/IP |
| Password reset | 5/hour/email |
| Public API | 120/min/IP |
| Authenticated | 600/min/user |
| Webhooks | 1000/min (signature required) |

Implementation: Redis sliding window; `429` + `Retry-After` header.

---

## 6. Input Validation

- All DTOs validated with `class-validator` + `class-transformer`  
- Whitelist mode: strip unknown properties  
- SQL: parameterized queries only (ORM)  
- No raw SQL without security review  
- File upload: MIME sniff + extension allowlist; virus scan (ClamAV worker) Phase 2+  

---

## 7. OWASP Top 10 Mitigations

| Risk | Mitigation |
|------|------------|
| A01 Broken Access Control | RBAC + tenant guards + tests |
| A02 Cryptographic Failures | TLS 1.2+, AES-256 at rest (RDS, S3) |
| A03 Injection | ORM, validation, CSP |
| A04 Insecure Design | Threat modeling per phase |
| A05 Security Misconfiguration | IaC, hardened AMIs, no default creds |
| A06 Vulnerable Components | Dependabot, `npm audit`, Snyk CI |
| A07 Auth Failures | JWT best practices, lockout |
| A08 Software/Data Integrity | Signed images, webhook HMAC |
| A09 Logging Failures | Structured audit + security alerts |
| A10 SSRF | Allowlist outbound URLs for webhooks |

---

## 8. API Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=()
```

---

## 9. Encryption

| Data | Method |
|------|--------|
| In transit | TLS 1.2+ everywhere |
| RDS | AWS encryption at rest (KMS) |
| S3 | SSE-KMS |
| Secrets | AWS Secrets Manager; never in git |
| PII fields (optional) | Application-level AES-GCM for `client_phone` enterprise mode |

---

## 10. Audit Logging

Log: authentication events, permission denied, impersonation, billing changes, property/inquiry deletes, export downloads.

Retention: 1 year MVP; 7 years enterprise option.

---

## 11. AI & Telephony Security

- API keys in Secrets Manager; rotated quarterly  
- Call recordings encrypted at rest (S3 KMS)  
- Transcripts treated as PII — same access as inquiry  
- Prompt injection guardrails on AI summary (no tool execution from transcript)  

---

## 12. Incident Response

| Severity | Response time |
|----------|---------------|
| P0 data breach | 1 hour acknowledge, 24h initial report |
| P1 auth bypass | 4 hours |
| P2 | 1 business day |

Runbook in `docs/runbooks/` (create during Phase 1 ops).

---

## 13. Security Testing

- SAST in CI (Semgrep)  
- DAST staging weekly  
- Annual penetration test before enterprise GA  
- Tenant isolation integration tests mandatory on every PR touching repositories  

---

*Deployment hardening: [DEPLOYMENT.md](./DEPLOYMENT.md). RBAC: [RBAC.md](./RBAC.md).*
