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

Defined in `src/shared/events/integration-event.js`:

| Field                           | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `id`                            | Stable UUID for deduplication                  |
| `type`                          | Namespaced string, e.g. `order.created`        |
| `version`                       | Payload schema version                         |
| `aggregateType` / `aggregateId` | Entity reference                               |
| `tenantId`                      | Tenant scope (null for platform events)        |
| `payload`                       | JSON object                                    |
| `correlationId`                 | Links to originating request                   |
| `occurredAt`                    | Event timestamp                                |

Domain producers emit an input shape without `id`/`occurredAt`; the outbox assigns those at persistence time. The central catalog lives in `src/shared/events/event-catalog.js` (Phase 6).

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

## Phase 6 event consumption (ADR-019)

External webhook delivery resolves **OQ-031**:

```
outbox_events
    ↓ OutboxPublisher
integration-events (BullMQ)
    ↓ worker: publish-integration-event job
CompositeIntegrationEventRouter
    ├── LoggingIntegrationEventHandler (consumer: foundation.logging)
    └── WebhookDispatchEnqueueHandler (consumer: webhooks.dispatch-enqueue)
            ↓
    webhook-deliveries (BullMQ)
            ↓
    WebhookDeliveryService (Phase 6.4)
            ↓
    SSRF validation → HMAC signing → HTTPS POST
```

Rules:

1. Outbox → `integration-events` remains the first async stage (unchanged).
2. Each router handler uses a distinct inbox `consumer_name` for idempotent at-least-once processing.
3. Webhook dispatch creates `webhook_deliveries` rows and enqueues identifier-only jobs — **no HTTP in this stage**.
4. Delivery rows are unique on `(subscription_id, event_id)`; duplicate event processing is idempotent.
5. Queue jobs contain only `tenantId`, `deliveryId`, `subscriptionId`, `eventId`, and `eventType` — never webhook secrets.

Initial externally deliverable event types are listed in `PHASE_6_EXTERNAL_EVENT_ALLOWLIST` inside `event-catalog.js`.

## Phase 6.2 webhook persistence

Phase 6.2 adds tenant-scoped persistence:

- `webhook_subscriptions` — encrypted signing secret, event type allowlist, lifecycle status
- `webhook_deliveries` — one row per `(subscription_id, event_id)` ledger for HTTP dispatch

## Phase 6.3 webhook dispatch enqueue

Phase 6.3 wires the composite router and dispatch handler:

- `CompositeIntegrationEventRouter` in `src/workers/handlers/composite-integration-event-router.js`
- `WebhookDispatchService` selects ACTIVE tenant subscriptions whose allowlist includes the event type
- After the delivery row is persisted, a `webhook-deliveries` / `deliver-webhook` job is enqueued
- Delivery creation runs in a tenant-scoped database transaction; queue enqueue runs afterward (same pattern as the outbox publisher). Enqueue failures surface as handler errors so BullMQ/inbox retry can recover; duplicate job IDs are treated as idempotent.

## Phase 6.4 webhook HTTP delivery worker

Phase 6.4 implements `WebhookDeliveryService`, registered on the `webhook-deliveries` queue as `deliver-webhook`:

1. Load and validate the delivery row, subscription, and outbox event payload under tenant context.
2. Skip or dead-letter inactive subscriptions (`DISABLED`, `DELETED`) without HTTP.
3. Atomically claim the delivery attempt (`PENDING`/`FAILED` → `DELIVERING`, increment `attempt_count`).
4. Validate the subscription URL with SSRF checks (HTTPS-only, no private/loopback/metadata destinations).
5. Decrypt the signing secret immediately before signing; never log or persist plaintext secrets.
6. POST the integration-event envelope JSON with headers:
   - `Content-Type: application/json; charset=utf-8`
   - `X-Nexora-Event`, `X-Nexora-Event-Id`, `X-Nexora-Delivery-Id`
   - `X-Nexora-Signature: v1=<hex-hmac-sha256>` over the exact request body bytes
7. Classify HTTP responses:
   - `2xx` → `DELIVERED`
   - retryable (`408`, `425`, `429`, `5xx`, network/timeout) → `FAILED` and BullMQ retry until attempts exhausted
   - permanent `4xx` and redirects (`redirect: manual`) → `DEAD_LETTERED`
8. After BullMQ attempts are exhausted, mark `DEAD_LETTERED` with bounded `last_error` metadata.

Configuration:

- `WEBHOOK_DELIVERY_TIMEOUT_MS` — hard outbound HTTP timeout (default 10s)
- `WEBHOOK_DELIVERY_LEASE_SECONDS` — stale `DELIVERING` reclaim lease (default 300s)
- BullMQ retry/backoff uses existing `QUEUE_DEFAULT_ATTEMPTS` and `QUEUE_BACKOFF_BASE_MS`

Concurrency notes:

- Duplicate BullMQ jobs for the same delivery are serialized by `claimAttempt`: only one worker owns `DELIVERING` until the lease expires.
- Terminal updates require the row to still be `DELIVERING`, so a late HTTP response cannot overwrite `DELIVERED` or `DEAD_LETTERED`.
- `WEBHOOK_DELIVERY_TIMEOUT_MS` must not exceed the lease; with defaults (10s timeout, 300s lease) a slow HTTP call cannot overlap a lease reclaim. Misconfigured timeouts that exceed the lease could allow a second worker to reclaim and send a duplicate webhook.

## Not yet implemented

- Webhook admin HTTP API (`/api/v1/webhooks`)
- Secret rotation
- Full JSON Schema / Avro event registry (OQ-032)
- Kafka / NATS alternative transports
- Saga orchestration
