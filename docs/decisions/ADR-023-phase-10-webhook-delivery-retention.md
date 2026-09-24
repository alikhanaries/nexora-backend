# ADR-023: Phase 10 Webhook Delivery History Retention

**Status:** Accepted  
**Date:** 2026-09-24

## Context

Phase 6.4 introduced the `webhook_deliveries` ledger for asynchronous HTTP dispatch. Phase 6.6 added bounded retention for outbox, inbox, and idempotency infrastructure tables. [events.md](../architecture/events.md) and ADR-020 deferred **webhook delivery history retention** as post–Phase 7.5 operational work.

Terminal delivery rows (`DELIVERED`, `DEAD_LETTERED`) accumulate per tenant and subscription. Retryable rows (`PENDING`, `DELIVERING`, `FAILED`) must remain until the delivery worker completes or dead-letters them.

## Decision

Extend the existing `RetentionCleanupService` / worker scheduler with tenant-scoped webhook delivery purges:

| Status          | Eligible for deletion when                          | Never deleted by retention |
| --------------- | --------------------------------------------------- | -------------------------- |
| `DELIVERED`     | `COALESCE(delivered_at, created_at)` before cutoff  | —                          |
| `DEAD_LETTERED` | `created_at` before cutoff                          | —                          |
| `PENDING`       | —                                                   | Yes                        |
| `DELIVERING`    | —                                                   | Yes                        |
| `FAILED`        | —                                                   | Yes (BullMQ may retry)     |

- Configuration: `WEBHOOK_DELIVERY_RETENTION_DAYS` (default 30), reusing `RETENTION_CLEANUP_BATCH_SIZE` and scheduler interval.
- Purge runs per tenant via `database.execute({ tenantId })` so `webhook_deliveries` RLS policies remain enforced for the runtime role.
- Partial batches and cross-tenant fairness follow the same loop semantics as other retention resources.

## Consequences

**Positive**

- Closes the documented gap in events.md (“Not yet implemented — Webhook delivery history retention”).
- Reuses Phase 6.6 observability and scheduler patterns without a second cleanup mechanism.

**Negative**

- Large tenants with many subscriptions may require multiple sweeps; batch size caps work per run.

## Related

- [ADR-019](ADR-019-phase-6-webhooks-events.md)
- [ADR-020](ADR-020-phase-7-channel-inbound-integration.md) — deferred item table
- [events.md](../architecture/events.md)
