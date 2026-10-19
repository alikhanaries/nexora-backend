# Wasl Backend

Commerce integration platform backend (`wasl-backend`) implemented in **JavaScript (ES Modules)** on **Node.js 24**. The runtime includes NestJS (Express) API, PostgreSQL persistence, Redis infrastructure, object storage, job queue, transactional outbox, inbox deduplication, and idempotency — plus identity, commerce, fulfillment, and marketplace integration modules.

## Phase 1 scope

| In scope                                                 | Deferred                                         |
| -------------------------------------------------------- | ------------------------------------------------ |
| Modular monolith layout with enforced boundaries         | Splitting into separate deployable services      |
| Native API at `/api/v1`                                  | Breaking changes to public HTTP contracts        |
| PostgreSQL source of truth with RLS-ready tenant context | Full tenant RLS policies on every domain table   |
| Redis cache, distributed locks, rate limiting            | Separate Redis clusters in production            |
| BullMQ job queue + worker process                        | Domain-specific job handlers beyond current set  |
| Transactional outbox (at-least-once) + inbox dedup       | External webhook delivery guarantees beyond current |
| Idempotency records in PostgreSQL                        | —                                                |
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

# 5. Start the API (Nest — recommended)
npm run start:nest

# 6. Start the worker (terminal 2)
npm run dev:worker
```

The Nest API listens on `http://localhost:3000` by default (`SERVER_PORT`). Legacy Fastify entry: `npm run dev`.

## Verification

Run the quality gate (no Docker required for unit tests):

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
```

OpenAPI docs (when `DOCS_ENABLED=true`): [http://localhost:3000/docs](http://localhost:3000/docs)

## Common commands

| Command                  | Purpose                       |
| ------------------------ | ----------------------------- |
| `npm run start:nest`     | Production-style Nest API     |
| `npm run dev:nest`       | Nest API with file watch      |
| `npm run dev`            | Legacy Fastify API (watch)    |
| `npm run dev:worker`     | Background worker (watch)     |
| `npm run migrate`        | Apply database migrations     |
| `npm run test:unit`      | Unit tests (Vitest)           |
| `npm run test:jest`      | Nest controller tests (Jest)  |
| `npm run arch:check`     | Module boundary rules         |

## Configuration

Environment variables are validated in `src/app/config/schema.js`. Canonical application identity defaults live in `src/shared/config/wasl-naming.config.js` (`WASL_NAMING`, `APP_NAME=wasl-backend`).

## Documentation

See [docs/README.md](docs/README.md) for architecture, API, and operations guides.

## License

UNLICENSED — private / internal use unless otherwise agreed.
