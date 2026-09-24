# ADR-022: Phase 9 Channel Default Stock Location (OQ-7-07)

**Status:** Accepted  
**Date:** 2026-09-24

## Context

Channel order ingest (`POST /api/v2/orders` and channel-fulfilled) must assign each line to a Nexora stock location for inventory reservation. Phase 7.2 introduced an operational convention: store the stock location UUID in `channels.configuration_reference`. That works but is opaque, lacks a foreign key, and was tracked as open question **OQ-7-07**.

## Decision

Add nullable `channels.default_stock_location_id` with composite FK `(tenant_id, default_stock_location_id) → stock_locations(tenant_id, id)`.

- Native `/api/v1/channels` create/update accept `defaultStockLocationId` (UUID, nullable).
- Assignment validates the location belongs to the tenant and is active via public `InventoryService.verifyUsableStockLocation`.
- Compatibility ingest resolution prefers `defaultStockLocationId` when set; otherwise continues to use the legacy `configurationReference` UUID convention.

## Consequences

**Positive**

- Typed, tenant-scoped configuration for channel ingest.
- Database-enforced referential integrity.
- Backward compatible with existing `configurationReference` setups.

**Negative**

- Two configuration surfaces until operators migrate; documentation must describe precedence.

## Related

- [ADR-020](ADR-020-phase-7-channel-inbound-integration.md)
- [open-questions.md](../architecture/open-questions.md)
