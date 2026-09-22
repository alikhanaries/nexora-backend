# ADR-019: Phase 6 Integration Events & External Webhooks

**Status:** Accepted  
**Date:** 2026-09-22

## Context

Phase 5 delivered the Merchant-compatible `/api/v2` adapter. Commerce modules emit integration events into the transactional outbox, and the worker pipeline is proven end-to-end. The only consumer today is a logging stub (`LoggingIntegrationEventHandler`).

ADR-017 deferred marketplace/carrier integrations to subscribe to outbox events. OQ-031 (external webhook delivery architecture) has remained unresolved since Phase 3.

Tenants need a provider-neutral way to receive asynchronous notifications when orders, shipments, cancellations, and returns change state.

## Decision

### Phase 6 scope

Phase 6 implements **Integration Events & External Webhooks**:

1. **Phase 6.0–6.1 (foundation)** — ADR, OQ-031 resolution, shared integration event contract, central event catalog.
2. **Phase 6.2 (persistence foundation)** — webhook subscription/delivery tables, encrypted secret storage, application repositories, correlation ID outbox persistence fix, permissions.
3. **Phase 6.3 (dispatch enqueue)** — composite router, webhook delivery row creation, `webhook-deliveries` job enqueue (no HTTP).
4. **Phase 6.4 (HTTP delivery worker)** — SSRF validation, HMAC signing, outbound HTTPS POST, delivery state transitions, BullMQ retry/dead-letter.
5. **Phase 6.5+ (later slices)** — admin HTTP API, secret rotation, retention jobs.

Phase 6 does **not** include:

- Channel API order ingestion (ADR-018 separate scope)
- Merchant compatibility endpoint expansion
- Catalog/product/inventory event delivery (deferred to Phase 6.1+ catalog expansion)
- Notifications (email/SMS) — future phase

### Async pipeline (OQ-031 resolution)

The existing outbox → `integration-events` queue remains the **first async stage**. No change to ADR-005 transactional outbox semantics.

```
Domain TX → outbox_events → OutboxPublisher → BullMQ integration-events
  → Composite integration-event router (inbox-deduped handlers)
       → Logging handler (observability)
       → Webhook dispatch handler (enqueues delivery jobs only)
            → BullMQ webhook-deliveries → HTTP delivery worker
```

Rules:

1. **HTTP delivery must never run inline** in the `integration-events` consumer.
2. The composite router may enqueue work to a separate **`webhook-deliveries`** queue.
3. Webhook HTTP POST, retry, and dead-letter handling belong to the delivery worker on `webhook-deliveries`.
4. Each router handler uses a distinct inbox `consumer_name` for idempotent at-least-once processing.

### Event catalog

Phase 6 external delivery allowlist is defined in `src/shared/events/event-catalog.js`. Initial scope covers commerce/fulfillment events only:

- `order.*` (created, confirmed, status_changed, cancelled)
- `shipment.*` (created, shipped, delivered, cancelled, status_changed)
- `cancellation.*` (created, completed)
- `return.*` (created, status_changed)

Catalog/product/inventory/pricing/offer/channel/marketplace events are **not** externally deliverable in the initial Phase 6 allowlist.

### Architecture constraints (unchanged)

- Core remains provider-neutral; compatibility must not import webhooks.
- Webhooks module (when implemented) consumes integration events via worker handlers only — not by importing domain repositories.
- Cross-module communication continues through public contracts and async events.
- PostgreSQL RLS remains mandatory for webhook subscription data (future migrations).

## Consequences

**Positive**

- Closes the event consumption gap without changing outbox write semantics.
- Separates fast event routing from slow/unreliable HTTP delivery.
- Provides a central catalog for webhook subscription validation and PII policy.

**Negative**

- Two queue hops for webhook delivery (integration-events → webhook-deliveries).
- Operators must manage two worker concerns until a unified dashboard exists.

## Related

- [events.md](../architecture/events.md)
- [open-questions.md](../architecture/open-questions.md) — OQ-031 resolved
- [ADR-005](ADR-005-transactional-outbox.md)
- [ADR-006](ADR-006-inbox-deduplication.md)
- [ADR-017](ADR-017-phase-4-orders-fulfillment.md)
- [ADR-018](ADR-018-phase-5-merchant-compatible-scope.md)
