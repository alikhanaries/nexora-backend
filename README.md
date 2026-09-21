# Nexora Backend

Commerce and channel-management platform backend implemented in **JavaScript (ES Modules)** on **Node.js 24**. The runtime foundation includes HTTP server, PostgreSQL persistence, Redis infrastructure, object storage, job queue, transactional outbox, inbox deduplication, and idempotency — plus Phases 2–4 identity, commerce, and fulfillment modules.

## Phase 1 scope

| In scope                                                 | Deferred                                         |
| -------------------------------------------------------- | ------------------------------------------------ |
| Modular monolith layout with enforced boundaries         | Business modules (orders, products, channels, …) |
| Native API at `/api/v1` (foundation endpoints only)      | ChannelEngine compatibility at `/api/v2`         |
| PostgreSQL source of truth with RLS-ready tenant context | Full tenant RLS policies on domain tables        |
| Redis cache, distributed locks, rate limiting            | Separate Redis clusters in production            |
| BullMQ job queue + worker process                        | Domain-specific job handlers                     |
| Transactional outbox (at-least-once) + inbox dedup       | External webhook delivery                        |
| Idempotency records in PostgreSQL                        | AuthN / AuthZ                                    |
| MinIO/S3 object storage                                  | CDN integration                                  |
| Health, metrics, structured logging, optional tracing    | Full observability stack in default compose      |

## Requirements

- **Node.js 24+** (target runtime; see `engines` in `package.json`)
- Docker (for local PostgreSQL, Redis, MinIO)

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy and adjust environment
cp .env.example .env

# 3. Start infrastructure
docker compose up -d

# 4. Run migrations (also runs automatically on API startup)
npm run migrate

# 5. Start the API (terminal 1)
npm run dev

# 6. Start the worker (terminal 2)
npm run dev:worker
```

The API listens on `http://localhost:3000` by default.

## Verification

Run the full Phase 1 quality gate (no Docker required for unit tests):

```bash
npm run verify
```

This runs ESLint, architecture boundary checks (`dependency-cruiser`), and unit tests.

With Docker services running, exercise integration tests:

```bash
npm run test:integration
npm run test:all
```

Manual smoke checks:

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
curl http://localhost:3000/api/v1/foundation/ping
curl -X POST http://localhost:3000/api/v1/foundation/echo \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'
```

OpenAPI docs (when `DOCS_ENABLED=true`): [http://localhost:3000/docs](http://localhost:3000/docs)

## Common commands

| Command                  | Purpose                       |
| ------------------------ | ----------------------------- |
| `npm run dev`            | API with hot reload           |
| `npm run dev:worker`     | Worker with hot reload        |
| `npm run build`          | JavaScript syntax validation  |
| `npm run start`          | Run API (`src/app/main.js`)   |
| `npm run migrate`        | Apply pending SQL migrations  |
| `npm run migrate:status` | Show migration status         |
| `npm run arch:check`     | Enforce module boundary rules |
| `npm run lint`           | ESLint                        |
| `npm run format:check`   | Prettier check                |

## Repository layout

```
src/
  app/            HTTP server, config, bootstrap
  infrastructure/ Adapters (Postgres, Redis, BullMQ, S3, …)
  shared/         Ports and cross-cutting utilities (no I/O)
  modules/        Business modules (identity, commerce, orders, …)
  workers/        Background job entrypoint
docs/             Architecture, ADRs, operations guides
infrastructure/   Docker observability configs (Prometheus, OTel)
tests/            Unit and integration tests
```

## Documentation

Start at [`docs/README.md`](docs/README.md) for the full documentation index.

Architecture decisions live in [`docs/decisions/`](docs/decisions/).

## Node 24 target

The project targets **Node.js 24** as the production runtime. Local development may work on Node 22+, but CI and deployment images should use Node 24 to match `engines.node` and to pick up current LTS performance and security fixes.
