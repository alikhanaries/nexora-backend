# Phase 3 — Nest infrastructure wiring (JavaScript)

## Objective

Connect the NestJS Express shell to the same **configuration**, **Pino logging**, **metrics recorder**, and **PostgreSQL pool** used by the Fastify application—without migrating business modules or changing API contracts.

## What was wired

| Area | Approach |
|------|----------|
| Configuration | Existing `loadConfigFromEnvironment()` via `NexoraConfigModule` (unchanged) |
| Logger | `createPinoLogger(config)` → `NestLoggerService` for Nest internal logs |
| Metrics | `PrometheusMetrics` or `noopMetricsRecorder` (same as Fastify infra) |
| Database | `PostgresDatabase` + migrations + health check via `createNestInfrastructure()` |
| Readiness | `/health/ready` includes **postgres** probe when DB is connected |
| Shutdown | Mark not ready → close Postgres pool → close Nest app → flush Pino |

Not wired in Phase 3 (Phase 4+): Redis, BullMQ, S3, outbox publisher, auth guards, business routes.

## Bootstrap flow

```text
loadConfigFromEnvironment()
  → createNestInfrastructure(config)   // logger, metrics, Postgres
  → createNestApplication(config, infra)
  → listen(NEST_SERVER_PORT)
```

Tests use `createNestInfrastructure(config, { connectDatabase: false })` so Jest does not require Postgres.

## Files

- `src/nest/bootstrap/create-nest-infrastructure.js`
- `src/nest/database/database.module.js`, `database.service.js`
- `src/nest/common/nest-logger.service.js`
- `src/nest/app.module.js` — `buildAppModule(infra)` dynamic module
- `src/nest/main.js` — startup/shutdown with infra

## Dependencies

None added in Phase 3.

## Known limitations

- Nest `/health/ready` checks **postgres only**; Fastify still checks redis, queue, and storage.
- Nest runs migrations on startup when DB is enabled (same as API process).
- Two processes (`dev` + `dev:nest`) each hold their own Postgres pool.

## Phase 4

Wire Redis, queue, storage probes; auth guards; begin route migration per `docs/API_ROUTE_INVENTORY.md`.
