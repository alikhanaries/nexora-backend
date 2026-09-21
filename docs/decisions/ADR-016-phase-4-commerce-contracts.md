# ADR-016: Phase 4 Commerce Public Contracts

## Status

Accepted

## Context

Phase 4 (Orders) must validate products, channels, offers, pricing, and inventory without importing Phase 3 repositories or SQL.

## Decision

Expose stable application-level interfaces from each commerce module's `public/` entry:

| Contract              | Module    | Purpose                                             |
| --------------------- | --------- | --------------------------------------------------- |
| `ProductQueryService` | products  | Resolve products by id/SKU; verify tenant ownership |
| `ChannelQueryService` | channels  | Resolve channels; verify usable/active state        |
| `PricingService`      | pricing   | Resolve effective price at a point in time          |
| `InventoryService`    | inventory | Query availability; reserve/release/adjust/receive  |
| `OfferQueryService`   | offers    | Resolve offers; verify usable lifecycle state       |

Rules:

- DTOs are application models, not database rows.
- Methods accept `tenantId` explicitly or via caller context; never trust unauthenticated tenant input.
- Mutating methods accept an optional `Transaction` for participation in caller transactions.
- Repositories and infrastructure remain private to each module.

## Consequences

- dependency-cruiser enforces cross-module access through `public/` only.
- Phase 4 composition root wires these contracts into order use cases.
