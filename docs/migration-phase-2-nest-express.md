# Phase 2 — NestJS + Express foundation (JavaScript)

## Purpose

Introduce a **parallel** NestJS HTTP server using **Express** (`@nestjs/platform-express`) while the **Fastify** application remains the default production and development API (`npm run dev`).

No business routes are migrated in Phase 2. The existing **147** main-server endpoints stay on Fastify until later phases prove parity.

## Run servers

```bash
# Legacy API (full platform) — SERVER_PORT, usually 3000
npm run dev

# Nest foundation — separate port (default 3001 if SERVER_PORT is 3000)
npm run dev:nest
```

PowerShell:

```powershell
$env:NEST_SERVER_PORT=3001; npm run dev:nest
```

Both can run concurrently when ports differ.

## Nest port

| Variable | Behavior |
| -------- | -------- |
| `NEST_SERVER_PORT` | Explicit Nest listen port |
| (unset) | Defaults to **3001**, or `SERVER_PORT + 1` if 3001 would collide |

## Phase 2 Nest routes

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/health/live` | `{ "status": "ok" }` — same as Fastify |
| GET | `/health/ready` | Process-only readiness (no DB/Redis in Phase 2) |

Not migrated in Phase 2: `/api/v1/*`, `/api/v2/*`, `/api/v2/ce/*`, metrics, Swagger, webhooks (business handlers), workers.

## Express foundation (webhooks)

`src/nest/bootstrap/configure-express.js` installs **route-scoped raw body capture** for paths containing `/api/v1/inbound/marketplace-webhooks/`, matching the Fastify `preParsing` behavior required for Shopify HMAC and other signature verification.

## Tests

```bash
# Existing Vitest suite (unchanged)
npm run test:unit
npm run test:integration

# New Nest foundation tests (Jest + Supertest)
npm run test:jest
```

## Code layout

- `src/nest/` — Nest bootstrap, modules, Express configuration
- `src/app/` — Legacy Fastify application (unchanged default entry)
- `test/nest/` — Jest foundation tests

## Follow-up (Phase 3+)

- Wire Postgres, Redis, BullMQ, and full readiness probes into Nest
- Auth guards mirroring `authentication.plugin.js`
- Migrate controllers per `docs/API_ROUTE_INVENTORY.md`
- OpenAPI on Express when docs are enabled
