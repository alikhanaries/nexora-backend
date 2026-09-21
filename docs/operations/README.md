# Operations Guide

Running Nexora Backend in development and preparing for production deployment.

## Processes

| Process    | Entry                 | Purpose                            |
| ---------- | --------------------- | ---------------------------------- |
| **API**    | `src/app/main.ts`     | HTTP server, outbox publisher      |
| **Worker** | `src/workers/main.ts` | BullMQ consumers, inbox processing |

Both processes call `createInfrastructure()` and share PostgreSQL, Redis, and storage configuration.

## Local stack

```bash
# Core dependencies (postgres, redis, minio)
docker compose up -d

# Optional observability profile
docker compose --profile observability up -d
```

| Service        | Port | Credentials (local)    |
| -------------- | ---- | ---------------------- |
| PostgreSQL     | 5432 | nexora / nexora        |
| Redis          | 6379 | none                   |
| MinIO API      | 9000 | nexora / nexora-secret |
| MinIO Console  | 9001 | same                   |
| Prometheus     | 9090 | observability profile  |
| OTel Collector | 4318 | observability profile  |

## Startup sequence

1. Ensure Docker services healthy: `docker compose ps`
2. Copy `.env.example` → `.env`
3. `npm run migrate` (optional — API runs migrations on boot)
4. `npm run dev` (API)
5. `npm run dev:worker` (worker)

Verify:

```bash
curl -s http://localhost:3000/health/ready | jq .
```

## Health checks

| Probe     | Path            | Pass                                     | Fail                         |
| --------- | --------------- | ---------------------------------------- | ---------------------------- |
| Liveness  | `/health/live`  | 200 `{ status: "ok" }`                   | process down                 |
| Readiness | `/health/ready` | 200 `{ status: "ready", checks: [...] }` | 503 — dependency unavailable |

Readiness evaluates: database ping, Redis ping, queue connection, storage head-bucket.

## Graceful shutdown

Both processes handle `SIGTERM` and `SIGINT`:

1. Stop accepting new HTTP requests (API) or jobs (worker)
2. Wait for in-flight work up to `SERVER_SHUTDOWN_TIMEOUT_MS` (default 15 s)
3. Close Redis, database pool, tracing

Orchestrators should use `terminationGracePeriodSeconds` ≥ shutdown timeout.

## Metrics

When `METRICS_ENABLED=true`:

- Scrape `GET /metrics` (Prometheus text format)
- Local Prometheus config: `infrastructure/observability/prometheus.yml`

Key metrics to watch (as domain modules add instrumentation):

- HTTP request duration histogram
- Database pool utilisation
- Queue job success/failure rates
- Outbox backlog size (future metric)

## Tracing

Set `TRACING_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces` with the observability profile.

Service name: `OTEL_SERVICE_NAME` (default `nexora-backend`).

## Migrations

```bash
npm run migrate          # apply pending
npm run migrate:status   # list applied
```

Migrations also run on API startup via `PostgresDatabase.runMigrations()`. Workers assume schema is current.

**Production:** run migrations as a separate deploy step before rolling new API versions.

## Logging

- Level: `LOG_LEVEL` (default `info`)
- Pretty print: `LOG_PRETTY=true` for local dev only
- JSON logs in production for log aggregation

## Configuration reference

Full variable list: `.env.example` with inline comments.

Critical production overrides:

- Strong database and storage credentials
- `NODE_ENV=production`
- `LOG_PRETTY=false`
- `DOCS_ENABLED=false` unless public API docs intended
- `DATABASE_SSL=true`
- Separate `QUEUE_REDIS_URL` from cache Redis

## Troubleshooting

| Symptom                | Check                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| Readiness 503          | `docker compose ps`, DATABASE_URL, REDIS_URL                            |
| Worker not processing  | Worker process running? Redis `noeviction`?                             |
| Outbox backlog growing | Publisher logs, `OUTBOX_MAX_ATTEMPTS`, dead-letter rows                 |
| MinIO errors           | Bucket exists (`minio-init` completed), `STORAGE_FORCE_PATH_STYLE=true` |

## Related

- [infrastructure/README.md](../../infrastructure/README.md) — observability configs
- [Scalability](../architecture/scalability.md)
- [Database guide](../database/README.md)
