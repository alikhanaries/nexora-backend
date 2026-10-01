# Migration Phase 4 — Core Application Modules

## Objective

Migrate foundational **identity (auth)** and **tenants** HTTP endpoints into NestJS (Express adapter) using a simple **Module → Controller → Service** layout, reusing existing use cases and preserving API contracts. Health endpoints remain as implemented in Phases 2–3.

## Modules migrated

| Nest module | Legacy source |
|-------------|---------------|
| `HealthModule` | Already on Nest (Phase 2/3) |
| `AuthModule` | `src/modules/identity/presentation/auth.routes.js` |
| `TenantsModule` | `src/modules/tenants/presentation/tenant.routes.js` |
| `CoreDomainModule` | Wired via `wire-core-domain.js` (same factories as Fastify) |
| Global `AuthGuard` | `src/app/http/plugins/authentication.plugin.js` |

## Endpoints migrated (Nest)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health/live` | Public |
| GET | `/health/ready` | Public |
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/refresh` | Public |
| POST | `/api/v1/auth/logout` | Public |
| GET | `/api/v1/auth/me` | Bearer or API key |
| POST | `/api/v1/tenants` | Public (201) |
| GET | `/api/v1/tenants/:tenantId` | Public |
| POST | `/api/v1/tenants/:tenantId/suspend` | Authenticated + RBAC (use case) |
| POST | `/api/v1/tenants/:tenantId/reactivate` | Authenticated + RBAC |
| POST | `/api/v1/tenants/:tenantId/close` | Authenticated + RBAC |

## Existing logic reused

- `createIdentityModule`, `createTenantsModule`, `createAuthorizationModule`, `createAuditModule`
- Identity use cases: login, refresh, logout, getCurrentUser
- Tenant use cases: create, get, suspend, reactivate, close
- `AuthenticateAccessTokenUseCase`, `VerifyApiKeyUseCase` (via `createApiKeysModule`)
- Zod schemas from `auth.routes.js` and `tenant.schemas.js`
- `toTenantResponse`, `parseOrThrow`, `requireActorContext`, `enrichRequestContext`
- `isPublicRoute` rules aligned with `authentication.plugin.js`
- Nest infrastructure: Postgres, Redis rate limiter for login (Phase 3 + extended infra)

## Authentication / RBAC

- Global `AuthGuard` mirrors Fastify preHandler: public routes, JWT, or API key (not both).
- `@Public()` on handlers that are public in Fastify; path rules duplicated in `common/auth/public-route.js`.
- Tenant lifecycle mutations use existing use-case permission checks via `requireActorContext()`.
- **Not migrated:** `/api/v1/permissions`, `/api/v1/roles`, MFA, API key management routes.

## Files added

- `src/nest/auth/*`
- `src/nest/tenants/*`
- `src/nest/domain/core-domain.module.js`, `core-domain.tokens.js`
- `src/nest/bootstrap/wire-core-domain.js`
- `src/nest/common/guards/auth.guard.js`
- `src/nest/common/decorators/public.decorator.js`
- `src/nest/common/auth/public-route.js`
- `test/nest/core-modules.test.js`
- `docs/migration-phase-4-core-modules.md`

## Files changed

- `src/nest/app.module.js` — core modules + `APP_GUARD`
- `src/nest/main.js` — wire core domain, Redis shutdown
- `src/nest/bootstrap/create-nest-application.js` — optional `coreDomain`
- `src/nest/bootstrap/create-nest-infrastructure.js` — Redis + rate limiter for auth
- `src/modules/identity/presentation/auth.routes.js` — export body schemas for Nest
- `test/nest/helpers/create-test-nest-app.js` — optional mock `coreDomain`

## Tests added

- `test/nest/core-modules.test.js` — public login, protected `/auth/me`, public tenant create (mocked domain)

## Test results (Phase 4 completion)

```
Jest: 15/15 passed
Vitest (unit): 623/623 passed
Syntax check: 1046 JavaScript files passed
```

Run Nest locally: `npm run dev:nest` (PostgreSQL + Redis recommended for login rate limits).  
Fastify unchanged: `npm run dev`.

## Route parity verification

- Paths and methods match Fastify route definitions.
- Response envelopes `{ success, data }` unchanged.
- Status codes: explicit `@HttpCode(200)` on POST auth and tenant lifecycle routes (Nest defaults POST to 201); tenant create remains **201**.
- Validation uses the same Zod schemas as Fastify.
- Auth failures use existing `AuthenticationError` → global filter envelope.

## Known limitations / follow-up

- Merchant-compat query API key paths (`isMerchantCompatQueryAuthPath`) are not applied in the Nest guard until compatibility routes are migrated.
- Authorization module HTTP routes (roles/permissions) remain Fastify-only.
- When PostgreSQL is unavailable, Nest boots health only (no auth/tenants modules registered).

## Phase 5 recommendations

1. Migrate **authorization** HTTP module (`/api/v1/permissions`, roles, memberships).
2. Migrate **users** / **memberships** endpoints tied to admin UX.
3. Migrate **API keys** and **MFA** presentation routes.
4. Add integration tests against real Postgres for Nest auth login (optional, alongside existing Vitest integration suite).
5. Continue marketplace and order domains in later phases per audit.
