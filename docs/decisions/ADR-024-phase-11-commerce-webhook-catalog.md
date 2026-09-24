# ADR-024: Phase 11 Commerce Webhook Catalog Expansion

**Status:** Accepted  
**Date:** 2026-09-24

## Context

Phase 7.5 extended external webhook delivery to product and inventory integration events ([ADR-019](ADR-019-phase-6-webhooks-events.md), [events.md](../architecture/events.md)). The same documents intentionally deferred **offer.**, **channel.**, and **price.*** families because they were tenant-scoped, low PII, and already emitted to the outbox — but excluded from `PHASE_6_EXTERNAL_EVENT_ALLOWLIST` to limit Phase 7.5 scope.

Commerce modules (`offers`, `channels`, `pricing`) already publish version-1 integration events through the transactional outbox. Webhook subscription validation rejects any type not marked `externallyDeliverable` in `INTEGRATION_EVENT_CATALOG`.

## Decision

Extend `INTEGRATION_EVENT_CATALOG` and `PHASE_6_EXTERNAL_EVENT_ALLOWLIST` with nine tenant-scoped commerce events:

| Event type | Producer module |
| ---------- | ----------------- |
| `offer.created`, `offer.updated`, `offer.status_changed` | offers |
| `channel.created`, `channel.updated`, `channel.status_changed` | channels |
| `price.created`, `price.updated`, `price.changed` | pricing |

All are classified **low PII** (identifiers, status, and commercial metadata only — no customer PII). Payload shapes match existing outbox producers; no new queues or dispatch workers.

**Still excluded:** `marketplace.*` events (null `tenantId` on envelope — dispatch already skips).

## Consequences

**Positive**

- Tenants can subscribe to full catalog/pricing/channel lifecycle notifications without custom polling.
- Reuses Phase 6 webhook pipeline unchanged.

**Negative**

- Larger subscription surface area for operators to reason about (documented in events.md).

## Related

- [ADR-019](ADR-019-phase-6-webhooks-events.md)
- [events.md](../architecture/events.md)
