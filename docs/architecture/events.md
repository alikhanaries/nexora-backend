# Events Architecture

Nexora uses **integration events** for cross-module and cross-system communication. Phase 1 implements the transport plumbing; domain events arrive with business modules.

## Delivery guarantee: at-least-once

Events may be delivered more than once. Consumers **must** be idempotent. The inbox table provides deduplication per consumer.

```
Producer                    Outbox / Queue                 Consumer
────────                    ──────────────                 ────────
Business TX ──► outbox_events ──► BullMQ ──► Worker ──► inbox_messages ──► Handler
   (atomic)      (same TX)         (retry)     (dedup PK)
```

## Integration event shape

Defined in `src/shared/events/integration-event.ts`:

| Field                           | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `id`                            | Stable UUID for deduplication                  |
| `type`                          | Namespaced string, e.g. `orders.order_created` |
| `version`                       | Payload schema version                         |
| `aggregateType` / `aggregateId` | Entity reference                               |
| `tenantId`                      | Tenant scope (null for platform events)        |
| `payload`                       | JSON object                                    |
| `correlationId`                 | Links to originating request                   |
| `occurredAt`                    | Event timestamp                                |

## Transactional outbox

**Table:** `outbox_events` (migration `0002`)

Writing flow (future domain code):

1. `BEGIN`
2. Persist business change
3. `INSERT INTO outbox_events (...)`
4. `COMMIT`

**Publisher** (`OutboxPublisher`):

- Polls unpublished rows (`published_at IS NULL`, not dead-lettered)
- Claims rows to avoid duplicate publish under multiple publishers
- Enqueues `integration-events` / `publish-integration-event` job
- Marks `published_at` on success; increments `attempt_count` on failure
- Dead-letters after `OUTBOX_MAX_ATTEMPTS`

Configuration: `OUTBOX_BATCH_SIZE`, `OUTBOX_POLL_INTERVAL_MS`, `OUTBOX_MAX_ATTEMPTS`.

See [ADR-005](../decisions/ADR-005-transactional-outbox.md).

## Inbox deduplication

**Table:** `inbox_messages` (migration `0003`)

Primary key: `(consumer_name, event_id)`.

`InboxConsumer` flow:

1. Attempt insert with status `processing`
2. On conflict — event already seen; skip handler
3. Run handler
4. Update status to `processed` or `failed`

Each consumer registers a unique `consumer_name` (e.g. `integration-events.logger`).

See [ADR-006](../decisions/ADR-006-inbox-deduplication.md).

## Job queue

**Queue:** `integration-events` (`QueueName.INTEGRATION_EVENTS`)

**Job:** `publish-integration-event`

Worker entrypoint: `src/workers/main.ts` registers handlers via `registerWorkerHandlers`.

BullMQ provides retries with exponential backoff (`QUEUE_BACKOFF_BASE_MS`, `QUEUE_DEFAULT_ATTEMPTS`).

See [ADR-008](../decisions/ADR-008-bullmq-job-queue.md).

## Event versioning

- Increment `event_version` on breaking payload changes.
- Consumers branch on `version` or use tolerant readers.
- Never reuse an `event_type` string with incompatible payload shapes without bumping version.

## Correlation

Request context supplies `correlationId` for tracing events back to HTTP requests. Pass it when recording new events.

## Failure handling

| Failure                | Behaviour                                                  |
| ---------------------- | ---------------------------------------------------------- |
| Publish to queue fails | Outbox row retried; attempt_count incremented              |
| Handler throws         | Inbox row marked `failed`; job may retry per BullMQ policy |
| Max attempts exceeded  | Outbox row dead-lettered (`dead_lettered_at` set)          |

Dead-lettered events require operator intervention — they are not silently dropped.

## Phase 1 verification

Integration tests in `tests/integration/outbox-inbox.test.ts` exercise the full publish → consume → dedup path against real PostgreSQL and Redis.

## Not in Phase 1

- External webhook dispatch
- Event schema registry
- Kafka / NATS alternative transports
- Saga orchestration
