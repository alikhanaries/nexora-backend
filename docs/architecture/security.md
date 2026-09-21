# Security Architecture

Phase 2 implements identity, authentication, authorization, API keys, MFA, and audit integration on the Phase 1 foundation.

## Authentication

- **Password login** with Argon2id hashing and centralized password policy.
- **Short-lived JWT access tokens** (HS256 or RS256 from configuration).
- **Opaque rotating refresh tokens** stored as SHA-256 hashes with family reuse detection.
- **API key authentication** separate from bearer tokens (`X-Api-Key` or `Authorization: ApiKey`).
- **TOTP MFA** with encrypted secrets and one-time recovery codes.
- **Step-up authentication** recorded server-side in `step_up_sessions`.

Generic error messages prevent account enumeration on login and password reset.

## Authorization

Permission-based checks only — role names are never the security boundary.

```text
requirePermission("orders.read")
requirePermission("users.manage")
```

Effective permissions are the union of all active roles on an active membership. API key scopes intersect with principal permissions.

## Tenant isolation

- Tenant context is set transaction-locally via `set_config('app.tenant_id', $1, true)`.
- Row-level security on tenant-owned tables (`tenant_memberships`, `roles`, `api_keys`, etc.).
- Client-supplied `X-Tenant-ID` or body/query tenant IDs are never trusted.

## Rate limiting

Redis-backed policies on sensitive routes:

| Policy                              | Scope                 |
| ----------------------------------- | --------------------- |
| `auth.login`                        | IP + email identifier |
| `auth.refresh`                      | IP + session family   |
| `auth.password-reset`               | IP + email            |
| `auth.mfa`                          | IP + user             |
| `api-key.create` / `api-key.rotate` | tenant + actor        |

Fail closed when Redis is unavailable for authentication operations.

## HTTP hardening

- **Helmet** secure headers (CSP disabled for Scalar).
- **CORS** off by default; exact origins only when enabled.
- **Body size limit** via `SERVER_BODY_LIMIT_BYTES`.
- **Authentication plugin** establishes trusted principal before protected routes.

## Secrets

Never stored or logged in plaintext:

- Passwords, refresh tokens, API key secrets, MFA secrets, recovery codes, reset tokens.

## Last-admin invariant

Removing `tenant.admin` from the last admin-capable membership is blocked transactionally with row locking.

## Related documents

- [docs/security/README.md](../security/README.md)
- [audit-logging.md](audit-logging.md)
- [ADR-012](../decisions/ADR-012-standard-system-roles.md)
