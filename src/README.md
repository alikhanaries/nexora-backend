# Source Code Layout

Top-level organisation of `src/`. Phase 1 implements platform layers; `modules/` is reserved for business domains.

## Directory map

```
src/
├── app/              Application entry, HTTP server, config
├── infrastructure/   Shared adapters (Postgres, Redis, S3, BullMQ, …)
├── shared/           Ports, types, utilities — no I/O
├── modules/          Business modules (empty in Phase 1)
└── workers/          Background worker entrypoint
```

## `app/`

Wires the running API process.

| Path             | Role                                                               |
| ---------------- | ------------------------------------------------------------------ |
| `main.js`        | Process entry — load config, create infra, start HTTP server       |
| `bootstrap/`     | `createInfrastructure`, `createApplication`, shutdown, migrate CLI |
| `config/`        | Zod schema, env parsing — **only** place that reads `process.env`  |
| `http/`          | Fastify server factory, plugins, routes                            |
| `errors/`        | HTTP error envelope and mapper                                     |
| `observability/` | Readiness probes                                                   |

## `infrastructure/`

Implements `shared/` ports with concrete technology:

- `postgres/` — database pool, migrations, outbox, inbox, idempotency
- `redis/` — cache, locks, rate limiter, key naming
- `queue/` — BullMQ producer and worker runtime
- `storage/` — S3/MinIO provider
- `observability/` — Pino logger, Prometheus metrics, OpenTelemetry
- `http/` — Fetch-based outbound HTTP client

**Rule:** must not import from `modules/` or `app/`.

## `shared/`

Cross-cutting contracts and pure utilities:

- `cache/`, `events/`, `http/`, `idempotency/`, `logging/`, `metrics/`, `queue/`, `rate-limit/`, `storage/`, `validation/`, `errors/`, `context/`, `pagination/`, `persistence/`

**Rule:** must not import from `app/`, `infrastructure/`, `modules/`, or `workers/`.

## `modules/`

Business bounded contexts — see [modules/README.md](modules/README.md). Empty in Phase 1.

## `workers/`

Separate Node process for BullMQ consumers. Shares bootstrap with API via `createInfrastructure()`.

## Dependency flow

```
app ──► infrastructure ──► shared
  │                        ▲
  └──► modules ────────────┘
         domain → application → infrastructure/presentation
```

Run `npm run arch:check` to verify.

## Adding code

| Change type                 | Location                                |
| --------------------------- | --------------------------------------- |
| New env variable            | `app/config/schema.ts` + `.env.example` |
| New shared port             | `shared/<concern>/`                     |
| New adapter                 | `infrastructure/<tech>/`                |
| New HTTP route (foundation) | `app/http/routes/`                      |
| New business feature        | `modules/<name>/` (Phase 2+)            |
| New migration               | `infrastructure/postgres/migrations/`   |

## Related

- [docs/architecture/module-boundaries.md](../docs/architecture/module-boundaries.md)
- [tests/README.md](../tests/README.md)
