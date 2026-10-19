# Platform Independence

Wasl is an **independent, provider-neutral commerce platform**. Optional external compatibility and outbound integrations exist at explicit boundaries — Wasl does not depend on another commerce platform for core functionality.

## Source of truth

| Layer | Role |
| ----- | ---- |
| **PostgreSQL** | System of record for business data |
| **Wasl domain/application logic** | Business rules and state machines |
| **Wasl workers** | Async processing (outbox → BullMQ) |
| **Wasl events** | Cross-module reactions and integration triggers |
| **`/api/v1`** | Native product API |
| **`/api/v2`** | Optional external compatibility surface only |
| **Integration adapters** | Explicit outbound connections when a customer requires them |

Wasl must **not**:

- Call another commerce platform's API for core functionality
- Proxy native requests to an external platform
- Use an external platform as Nexora's source of truth
- Copy an external platform's database schema or internal architecture
- Import an external commerce SDK as a core runtime dependency
- Require external credentials for native `/api/v1` operation

External API documentation may be used as **reference material** for compatibility contract design. It is not an implementation dependency.

## Architecture

```
                    ┌─────────────────────┐
                    │    Wasl APIs      │
                    │      /api/v1        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Wasl modules    │
                    │ Orders, Products,   │
                    │ Inventory, …        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ PostgreSQL / Redis  │
                    │ S3 / BullMQ         │
                    └─────────────────────┘
```

Optional compatibility (not required for core operation):

```
External-compatible client
          │
          ▼
   /api/v2 compatibility
          │
          ▼
Wasl public contracts
          │
          ▼
   Wasl core modules
          │
          ▼
      PostgreSQL
```

Compatibility translates external requests to Wasl operations against **Nexora's own database**. It does not call an external commerce API to fulfil native or compatibility reads/writes unless the feature is an **explicit outbound integration** (customer-connected external system).

## Independence test

For every compatibility feature:

> If the external platform disappeared permanently, could Wasl still perform this operation using its own database and business logic?

- **Native `/api/v1` functionality:** answer must be **YES**
- **Compatibility endpoints:** answer must be **YES** (adapter → public contract → core → PostgreSQL)
- **Outbound integrations:** may be **NO** by design — must live in isolated integration infrastructure, not core modules

## Provider-neutral core

Core modules (`orders`, `products`, `inventory`, `pricing`, `shipments`, `returns`, `cancellations`, …) must not:

- Import `src/modules/compatibility/`
- Branch on external provider names
- Define provider-specific domain types (`ChannelEngineOrder`, etc.)

Use generic concepts internally (`externalOrderReference`, `externalReference`) and translate at the compatibility boundary when required.

## Database

Nexora-owned tables (`orders`, `products`, `inventory_balances`, …) are the source of truth. External identifiers use generic columns such as `external_order_reference` where needed — not provider-specific table or column names.

## Configuration

Native Wasl operation must not require external commerce platform configuration (`*_API_URL`, `*_API_KEY` for a specific provider in core config). Outbound provider credentials belong only inside an isolated integration boundary when explicitly required.

## Removability

Removing `src/modules/compatibility/` must not break Wasl core business modules. Core modules must compile and operate without importing compatibility. The composition root registers compatibility as an optional adapter — core factories do not depend on it.

## Marketplace catalog adapters (Phase 21)

Outbound marketplace catalog sync uses **`MarketplaceCatalogAdapter`** implementations registered in the `marketplaces` module (`shopify`, `amazon`, `noon`, `namshi`, …). Core modules (`products`, `offers`, `pricing`, `inventory`, `channel-catalog-sync` orchestration) resolve adapters by `marketplaces.key` only — never with provider-specific branching.

Tenant credentials live in **`marketplace_connections`** (encrypted). Workers load connections at **job execution** via `MarketplaceAdapterRuntimeFactory`; credentials are not stored in BullMQ payloads, domain events, or integration events.

See [ADR-029](../decisions/ADR-029-marketplace-connector-framework.md) and [channel-catalog-sync README](../../src/modules/integration-catalog-sync/README.md).

See [module-boundaries.md](module-boundaries.md) for enforceable dependency rules and [compatibility.md](compatibility.md) for the `/api/v2` boundary.

## External ERP / OMS consumers

StockConnect and future ERPs are **external consumers** of Wasl APIs. They must not become the definition of Nexora's core model.

- HTTP: compatibility routes and mappers (`/api/v2`, `/api/v2/ce/*`).
- Webhooks: optional `WebhookPayloadStrategy` registrations at the worker composition root ([external-integration.md](external-integration.md)).
- IDs: provider namespaces on `external_integer_id_mappings` (e.g. `compat_v2`).

Tenant A and Tenant B may each use a different external consumer profile via configuration only.

Production deployment uses the same consumer-neutral configuration model — see [external-integration.md](external-integration.md) (Production deployment readiness).

## Related

- [ADR-018](../decisions/ADR-018-phase-5-merchant-compatible-scope.md) — Merchant-compatible scope
- [compatibility-matrix.md](compatibility-matrix.md) — endpoint scope and contract gaps
- [external-integration.md](external-integration.md) — ERP/consumer boundaries and webhook strategies

