# Security Architecture

Phase 1 establishes security **foundations**. Authentication, authorization, and tenant isolation on every route are planned for Phase 2.

## Current controls

### HTTP hardening

- **Helmet** sets secure HTTP headers (CSP disabled for Scalar docs compatibility).
- **CORS** is off by default (`SERVER_CORS_ORIGINS` empty). When enabled, only exact origins are allowed — no wildcards.
- **Body size limit** (`SERVER_BODY_LIMIT_BYTES`, default 1 MiB) limits request payload abuse.
- **Trust proxy** disabled by default; enable only behind a known reverse proxy.

### Configuration secrecy

- Secrets load from environment variables validated at startup.
- `.env` is gitignored; `.env.example` contains placeholders only.
- Logs redact sensitive field names via `shared/logging/redaction.ts`.

### Error responses

- Production errors return a structured envelope without stack traces.
- Internal details are logged server-side with request ID correlation.

### Database

- Parameterised queries in all repositories (no string-concatenated SQL).
- Statement and query timeouts limit resource exhaustion from slow queries.
- SSL to PostgreSQL configurable via `DATABASE_SSL`.

### Redis

- Keys namespaced by `REDIS_KEY_PREFIX` and `APP_INSTANCE_NAMESPACE`.
- BullMQ requires `noeviction` policy — documented in `docker-compose.yml`.

### Object storage

- Credentials via environment; MinIO defaults are for local dev only.
- Production must use IAM roles or scoped access keys with least privilege.

## Deferred (not in Phase 1)

| Control                             | Planned phase                 |
| ----------------------------------- | ----------------------------- |
| JWT / OAuth2 / API keys             | Phase 2                       |
| Role-based access control           | Phase 2                       |
| Row-level security on domain tables | Phase 2 (helper exists)       |
| Rate limiting on public routes      | Phase 2 (Redis limiter ready) |
| Audit log immutability guarantees   | Phase 2+                      |
| WAF / DDoS protection               | Infrastructure / edge         |
| Secret rotation automation          | Operations                    |

## Request identity

Phase 1 propagates **request ID** (`X-Request-Id`) through request context for log correlation. `SERVER_TRUST_INCOMING_REQUEST_ID` must remain `false` unless every client reaches the API through a trusted proxy that overwrites the header.

## Threat model (summary)

| Threat                          | Phase 1 mitigation              | Residual risk       |
| ------------------------------- | ------------------------------- | ------------------- |
| SQL injection                   | Parameterised queries           | Low                 |
| Oversized payloads              | Body limit                      | Low                 |
| Header injection via proxy      | Trust settings conservative     | Medium until auth   |
| Unauthorized API access         | None (no auth yet)              | **High — dev only** |
| Cross-tenant data access        | No domain data yet; RLS planned | Medium at Phase 2   |
| Secret leakage in logs          | Redaction                       | Low with discipline |
| Redis key collision across envs | Namespace prefix                | Low if configured   |

## Security development guidelines

1. Never commit secrets or real `.env` files.
2. New routes must validate input with Zod schemas.
3. Domain logic must not log PII unless required and redacted.
4. New dependencies require review — prefer packages already in use.
5. Run `npm run verify` before opening PRs.

## Related documents

- [docs/security/README.md](../security/README.md) — operational security checklist
- [audit-logging.md](audit-logging.md) — audit trail design
- [ADR-003](../decisions/ADR-003-postgresql-source-of-truth.md) — durable state in PostgreSQL
