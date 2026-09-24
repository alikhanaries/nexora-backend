# ADR-025: Phase 12 Webhook Retry-After Scheduling

**Status:** Accepted  
**Date:** 2026-09-24

## Context

Phase 6.4 webhook HTTP delivery classifies retryable responses (including `429`) and parses `Retry-After` into delivery metadata. ADR-020 deferred **Retry-After-aware webhook scheduling** as post–Phase 6.6 operational work. Until Phase 12, the header was recorded in `last_error` only; BullMQ used fixed exponential backoff regardless of upstream rate-limit hints.

The `webhook_deliveries.next_attempt_at` column already supports scheduling semantics for lease reclaim; it was not populated on `FAILED` retry paths.

## Decision

When a retryable HTTP response includes a valid `Retry-After` value:

1. Cap the delay with `WEBHOOK_DELIVERY_MAX_RETRY_AFTER_SECONDS` (default 3600).
2. Persist `FAILED` with `next_attempt_at = now() + delay` for observability and API listing.
3. Signal the worker via `WebhookDeliveryRetryError.retryDelayMs`.
4. The webhook delivery queue handler calls BullMQ `job.moveToDelayed()` instead of immediate rethrow, honouring the upstream backoff.

When `Retry-After` is absent, behaviour is unchanged: `next_attempt_at` stays null and BullMQ applies its configured exponential backoff.

## Consequences

**Positive**

- Respects subscriber rate limits and reduces avoidable 429 loops.
- Closes the ADR-020 deferred scheduling item without a second delivery mechanism.

**Negative**

- Delayed jobs bypass BullMQ’s default backoff for that attempt only; operators should monitor `next_attempt_at` and delivery metrics together.

## Related

- [ADR-019](ADR-019-phase-6-webhooks-events.md)
- [ADR-020](ADR-020-phase-7-channel-inbound-integration.md)
- [events.md](../architecture/events.md)
