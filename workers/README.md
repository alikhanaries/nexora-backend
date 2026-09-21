# Workers

This folder documents the **background worker process** at the repository root level. Worker source code lives in `src/workers/`.

## Process overview

The worker is a separate Node.js process from the API. It consumes BullMQ jobs — primarily integration events published from the transactional outbox.

```
src/workers/main.ts          Process entry
src/workers/handlers/        Job and event handlers
```

## Running locally

```bash
# Terminal 1 — API (includes outbox publisher)
npm run dev

# Terminal 2 — worker
npm run dev:worker
```

Production:

```bash
npm run build
npm run start:worker
```

## Lifecycle

1. Load config from environment (`loadConfigFromEnvironment`)
2. `createInfrastructure()` — same wiring as API (database, redis, queue, inbox, …)
3. Register BullMQ handlers via `registerWorkerHandlers`
4. `InboxConsumer` deduplicates integration events per consumer name
5. Graceful shutdown on SIGTERM/SIGINT via `gracefulShutdown`

## Queues (Phase 1)

| Queue                | Job                         | Handler                                         |
| -------------------- | --------------------------- | ----------------------------------------------- |
| `integration-events` | `publish-integration-event` | Routes to registered integration event handlers |

Queue names: `src/infrastructure/queue/queue-names.ts`.

## Adding handlers (Phase 2+)

1. Implement handler conforming to integration event interface
2. Register in `registerWorkerHandlers` or a module-specific registrar
3. Assign unique `consumer_name` for inbox deduplication
4. Add integration test covering idempotent redelivery

## Configuration

Worker shares queue-related environment with API:

- `QUEUE_REDIS_URL`, `QUEUE_PREFIX`, `QUEUE_WORKER_CONCURRENCY`
- `QUEUE_DEFAULT_ATTEMPTS`, `QUEUE_BACKOFF_BASE_MS`, `QUEUE_JOB_TIMEOUT_MS`
- `SERVER_SHUTDOWN_TIMEOUT_MS` for drain period

## Scaling

Run multiple worker replicas. BullMQ distributes jobs; inbox primary key prevents duplicate side effects per consumer.

Tune `QUEUE_WORKER_CONCURRENCY` per replica based on handler CPU/IO profile.

## Related

- [src/workers/main.ts](../src/workers/main.ts)
- [docs/architecture/events.md](../docs/architecture/events.md)
- [ADR-008 BullMQ](../docs/decisions/ADR-008-bullmq-job-queue.md)
- [docs/operations/README.md](../docs/operations/README.md)
