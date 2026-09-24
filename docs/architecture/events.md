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

Externally deliverable event types are listed in `PHASE_6_EXTERNAL_EVENT_ALLOWLIST` inside `event-catalog.js` (cumulative allowlist extended in Phase 7.5).

## Phase 7.5 webhook catalog expansion

Phase 7.5 extends the Phase 6 external allowlist so tenants can subscribe to catalog/inventory integration events that were already emitted to the outbox but previously rejected by webhook subscription validation.

### Newly externally deliverable events

| Event type | Producer | Aggregate | PII |
| ---------- | -------- | --------- | --- |
| `product.created` | products | product | low |
| `product.updated` | products | product | low |
| `product.status_changed` | products | product | low |
| `inventory.inventory_changed` | inventory | inventory_balance | low |
| `inventory.inventory_reserved` | inventory | inventory_balance | low |
| `inventory.inventory_released` | inventory | inventory_balance | low |

Rules (unchanged from Phase 6):

1. Only events marked `externallyDeliverable: true` in `INTEGRATION_EVENT_CATALOG` may appear on webhook subscriptions.
2. Dispatch still requires a non-null `tenantId` on the integration event envelope.
3. No new queues, dispatchers, or delivery workers were introduced.

### Payload and PII notes

- **Product events** expose product identifiers, merchant SKU, product type, and status transitions. `product.updated` includes a `changes` object with field-level from/to diffs for `externalReference` and `productType` only — no customer data.
- **Inventory events** expose product/location identifiers, movement quantities, optional reference metadata, and a balance snapshot (`onHand`, `reserved`, `available`). No secrets or customer PII are included.
- Webhook job payloads remain identifier-only; the HTTP delivery worker loads the outbox payload under tenant context.

### Intentionally excluded (Phase 7.5)

| Event family | Reason |
| ------------ | ------ |
| `marketplace.*` | Producers emit `tenantId: null` (platform-scoped). Dispatch skips null-tenant events. |
| `offer.*`, `channel.*`, `price.*` | Implemented in Phase 11 — see below. |
| `webhook_deliveries` retention | Implemented in Phase 10 — see Phase 6.6 table above. |

## Phase 11 commerce webhook catalog expansion

Phase 11 extends the cumulative external allowlist with offer, channel, and price integration events already produced by commerce modules ([ADR-024](../decisions/ADR-024-phase-11-commerce-webhook-catalog.md)).

| Event type | Producer | Aggregate | PII |
| ---------- | -------- | --------- | --- |
| `offer.created` | offers | offer | low |
| `offer.updated` | offers | offer | low |
| `offer.status_changed` | offers | offer | low |
| `channel.created` | channels | channel | low |
| `channel.updated` | channels | channel | low |
| `channel.status_changed` | channels | channel | low |
| `price.created` | pricing | price | low |
| `price.updated` | pricing | price | low |
| `price.changed` | pricing | price | low |

Rules unchanged from Phase 6 / 7.5: subscription validation uses `INTEGRATION_EVENT_CATALOG`; dispatch requires non-null `tenantId` on the envelope.

**Still excluded:** `marketplace.*` (null tenant scope).

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
   - when `Retry-After` is present on a retryable response, the delivery row stores `next_attempt_at` and the job is moved to BullMQ delayed state for that interval (capped by `WEBHOOK_DELIVERY_MAX_RETRY_AFTER_SECONDS`; see [ADR-025](../decisions/ADR-025-phase-12-webhook-retry-after-scheduling.md))
   - permanent `4xx` and redirects (`redirect: manual`) → `DEAD_LETTERED`
8. After BullMQ attempts are exhausted, mark `DEAD_LETTERED` with bounded `last_error` metadata.

Configuration:

- `WEBHOOK_DELIVERY_TIMEOUT_MS` — hard outbound HTTP timeout (default 10s)
- `WEBHOOK_DELIVERY_LEASE_SECONDS` — stale `DELIVERING` reclaim lease (default 300s)
- `WEBHOOK_DELIVERY_MAX_RETRY_AFTER_SECONDS` — upper bound for honouring HTTP `Retry-After` (default 3600s)
- BullMQ retry/backoff uses existing `QUEUE_DEFAULT_ATTEMPTS` and `QUEUE_BACKOFF_BASE_MS`

Concurrency notes:

- Duplicate BullMQ jobs for the same delivery are serialized by `claimAttempt`: only one worker owns `DELIVERING` until the lease expires.
- Terminal updates require the row to still be `DELIVERING`, so a late HTTP response cannot overwrite `DELIVERED` or `DEAD_LETTERED`.
- `WEBHOOK_DELIVERY_TIMEOUT_MS` must not exceed the lease; with defaults (10s timeout, 300s lease) a slow HTTP call cannot overlap a lease reclaim. Misconfigured timeouts that exceed the lease could allow a second worker to reclaim and send a duplicate webhook.

## Phase 6.6 retention cleanup

Phase 6.6 adds bounded retention sweeps for infrastructure tables that accumulate after successful processing. The worker process runs `RetentionCleanupScheduler` on `RETENTION_CLEANUP_INTERVAL_MS` (default 1 hour) and coordinates replicas with a Redis distributed lock.

| Resource            | Eligible rows                                                                 | Never deleted                                      |
| ------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| Outbox              | `published_at IS NOT NULL` and older than retention window                    | Unpublished, claimed, retryable, dead-lettered     |
| Inbox               | `status = 'processed'` with old `processed_at`                                | `processing`, `failed` (retryable)                 |
| Idempotency         | `expires_at` older than retention window                                      | Non-expired and in-progress (`processing`) records |
| Webhook deliveries  | Terminal `DELIVERED` / `DEAD_LETTERED` rows older than retention window     | `PENDING`, `DELIVERING`, `FAILED` (retryable)      |

Each resource is purged in batches of `RETENTION_CLEANUP_BATCH_SIZE` (default 100) until a partial batch completes, so sweeps never hold a long-running transaction over the full table.

Configuration:

- `OUTBOX_RETENTION_DAYS` (default 30)
- `INBOX_RETENTION_DAYS` (default 30)
- `IDEMPOTENCY_RETENTION_DAYS` (default 7) — grace period after `expires_at` before physical deletion; replay semantics remain governed by `IDEMPOTENCY_TTL_SECONDS`
- `WEBHOOK_DELIVERY_RETENTION_DAYS` (default 30) — terminal webhook delivery ledger rows only ([ADR-023](../decisions/ADR-023-phase-10-webhook-delivery-retention.md))
- `RETENTION_CLEANUP_BATCH_SIZE` (default 100)
- `RETENTION_CLEANUP_INTERVAL_MS` (default 3600000)

Observability:

- Structured Pino logs for start, per-resource counts, duration, and failures (no payloads or PII)
- Prometheus: `nexora_retention_cleanup_deleted_total`, `nexora_retention_cleanup_runs_total`, `nexora_retention_cleanup_failures_total`, `nexora_retention_cleanup_duration_seconds`

Failure behaviour: each resource is cleaned independently; partial success is preserved, but the sweep fails overall when any category errors so the next scheduled run retries.

These tables are global infrastructure maintenance tables and are purged through the standard application database connection (not tenant-scoped RLS contexts).

## Not yet implemented

- Full JSON Schema / Avro event registry (OQ-032)
- Kafka / NATS alternative transports
- Saga orchestration
