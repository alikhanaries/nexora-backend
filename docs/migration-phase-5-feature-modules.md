# Migration Phase 5 — Feature Modules

## Phase objective

Migrate **authorization**, **audit**, **API keys**, and **MFA** HTTP endpoints into NestJS while reusing existing module factories and use cases. Phase 4 auth, tenants, health, and global auth guard remain unchanged.

## Migrated modules

- **AuthorizationModule** — roles, permissions, membership role assignment
- **AuditModule** — tenant audit event listing
- **ApiKeysModule** — list, create, rotate, revoke API keys
- **MfaModule** — TOTP enrollment, step-up, recovery codes

## Route parity

| Method | Path | Status |
|--------|------|--------|
| GET | `/api/v1/permissions` | PASS |
| GET | `/api/v1/roles` | PASS |
| POST | `/api/v1/roles` | PASS (201) |
| GET | `/api/v1/memberships/:membershipId/roles` | PASS |
| POST | `/api/v1/memberships/:membershipId/roles` | PASS (201) |
| DELETE | `/api/v1/memberships/:membershipId/roles/:roleId` | PASS (200) |
| GET | `/api/v1/audit` | PASS |
| GET | `/api/v1/api-keys` | PASS |
| POST | `/api/v1/api-keys` | PASS (201) |
| POST | `/api/v1/api-keys/:apiKeyId/rotate` | PASS (200) |
| POST | `/api/v1/api-keys/:apiKeyId/revoke` | PASS (200) |
| POST | `/api/v1/mfa/totp/start` | PASS (200) |
| POST | `/api/v1/mfa/totp/verify` | PASS (200) |
| POST | `/api/v1/mfa/totp/activate` | PASS (200) |
| POST | `/api/v1/mfa/verify` | PASS (200) |
| POST | `/api/v1/mfa/recovery-code/use` | PASS (200) |

**17 routes** added on Nest (plus Phase 4 routes unchanged).

## Architecture

Each feature uses **Module → Controller → Service**. Services call existing use cases via `CORE_DOMAIN` (wired in `wire-core-domain.js`). No new repositories or use-case layers.

## Business logic

Reused:

- `createAuthorizationModule`, `createAuditModule`, `createApiKeysModule`, `createMfaModule`
- Fastify route handlers’ validation schemas (authorization/audit from presentation; small Nest-local schemas for API keys/MFA matching Fastify Zod rules)
- `requireActorContext`, global `AuthGuard`, `parseOrThrow`

`wire-core-domain.js` now matches Fastify bootstrap order: audit → authorization → identity → MFA → API keys (with step-up) → tenants.

## Tests

- `test/nest/feature-modules.test.js` — auth required, sample success paths, MFA session guard
- `test/nest/helpers/mock-core-domain.js` — shared mock for Nest integration tests
- Phase 4 `core-modules.test.js` updated to use shared mock

## Files changed (important)

- `src/nest/bootstrap/wire-core-domain.js`
- `src/nest/app.module.js`
- `src/nest/authorization/*`, `audit/*`, `api-keys/*`, `mfa/*`
- `test/nest/feature-modules.test.js`, `helpers/mock-core-domain.js`
- `test/nest/core-modules.test.js`

## Dependencies

None

## Known limitations

- Marketplace, products, orders, channels, webhooks, compatibility, and metrics/docs routes remain Fastify-only.
- Merchant-compat query API key paths still not in Nest guard (unchanged from Phase 4).
- Identity **user admin** routes (if any outside auth) not migrated.

## Phase 6

Recommended next: **products**, **pricing**, **offers**, **inventory** (catalog stack), or **foundation/metrics** parity on Nest — per dependency order in `create-server.js`.
