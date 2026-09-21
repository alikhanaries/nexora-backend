# Security Guide

Operational security checklist for Nexora Backend developers and operators.

## Development

- [ ] Copy `.env.example` to `.env` — never commit `.env`
- [ ] Use Docker Compose defaults only on localhost
- [ ] Keep `SERVER_CORS_ORIGINS` empty unless testing browser clients
- [ ] Keep `DOCS_ENABLED=false` in shared/staging environments unless intentional
- [ ] Run `npm run verify` before pushing

## Environment variables

All secrets are loaded via `src/app/config/schema.ts`. Required secrets for local dev:

| Variable                    | Local default    | Production                   |
| --------------------------- | ---------------- | ---------------------------- |
| `DATABASE_URL`              | compose postgres | Managed DB connection string |
| `STORAGE_ACCESS_KEY_ID`     | nexora           | IAM / scoped key             |
| `STORAGE_SECRET_ACCESS_KEY` | nexora-secret    | Secret manager               |
| `REDIS_URL`                 | compose redis    | Managed Redis TLS URL        |

Rotate credentials if `.env` is ever committed or shared.

## Logging

- Structured logs via Pino — no `console.log` in application code.
- Redaction list in `src/shared/logging/redaction.ts` — extend when adding new sensitive fields.
- Include `requestId` in support tickets, not raw JWTs or passwords.

## Database

- All queries use parameter binding — never interpolate user input into SQL.
- Enable `DATABASE_SSL=true` for managed PostgreSQL in production.
- Restrict database network access to API and worker subnets only.

## Redis

- Use unique `APP_INSTANCE_NAMESPACE` per environment to prevent key collisions.
- BullMQ Redis must use `noeviction` — see `docker-compose.yml` comment.
- Prefer separate Redis instances for cache and queue in production.

## Object storage

- MinIO root credentials are for local dev only.
- Production buckets: block public access, enable versioning for audit-critical objects.
- Pre-signed URLs (future) should use short TTLs.

## HTTP exposure

Phase 1 has **no authentication**. Do not expose the API to the public internet without auth middleware (Phase 2).

Recommended edge controls for production:

- TLS termination at load balancer
- WAF or rate limiting at edge
- IP allowlists for admin paths when added

## Dependency hygiene

- Review new npm dependencies for maintenance status and license.
- Run `npm audit` periodically; triage findings by exploitability in context.
- Pin major versions in `package.json`; update deliberately.

## Incident response (outline)

1. Rotate compromised credentials immediately.
2. Identify affected tenants via audit logs (when available) and request IDs.
3. Preserve logs before rotation/deployment.
4. Post-mortem with root cause and preventive ADR if architectural.

## Related

- [Security architecture](../architecture/security.md)
- [Audit logging](../architecture/audit-logging.md)
