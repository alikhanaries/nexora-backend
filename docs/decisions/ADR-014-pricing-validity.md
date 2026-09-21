# ADR-014: Pricing Validity and Resolution

## Status

Accepted

## Context

Offers and future order flows need deterministic price resolution per product, channel, and currency without a full promotions engine in Phase 3.

## Decision

1. **Minor units** — prices store `amount_minor` as a non-negative integer with ISO 4217 `currency` (3-letter uppercase).
2. **Validity window** — a price is effective when `valid_from <= at` and (`valid_to IS NULL` OR `at < valid_to`). The upper bound is exclusive.
3. **Channel scope** — prices may be channel-specific (`channel_id` set) or tenant-wide (`channel_id` NULL). Channel-specific prices take precedence over tenant-wide prices for the same product and currency.
4. **Deterministic tie-break** — when multiple prices match, select the row with the latest `valid_from`, then lowest `id`.
5. **Overlap prevention** — application validation rejects overlapping active price periods for the same `(tenant, product, channel, currency)` tuple before insert/update.

## Consequences

- `PricingService.getEffectivePrice` returns a stable DTO or a not-found error; it never returns an arbitrary row.
- Phase 4 can resolve pricing synchronously during order creation without importing pricing infrastructure.
