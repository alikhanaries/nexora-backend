# ADR-015: Offer Lifecycle

## Status

Accepted

## Context

An offer represents a product's sellable representation on a channel. Phase 3 must enforce lifecycle rules without marketplace synchronization.

## Decision

1. **Status vocabulary** — `DRAFT`, `ACTIVE`, `INACTIVE`, `SUSPENDED`.
2. **Creation** — new offers start in `DRAFT` after validating product and channel belong to the same tenant.
3. **Activation** — requires:
   - product in an activatable state (`ACTIVE`)
   - channel usable (`ACTIVE`)
   - optional pricing resolution when `requirePricing: true`
4. **No embedded inventory or price copies** — availability and effective price are resolved through `InventoryService` and `PricingService` at activation or order time.
5. **Unique sellable identity** — one offer per `(tenant_id, product_id, channel_id)`.

## Consequences

- Offer activation failures surface as business-rule errors (422) with stable codes.
- Phase 4 validates offers through `OfferQueryService.verifyOfferUsable` before order placement.
