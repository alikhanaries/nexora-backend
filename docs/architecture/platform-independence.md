# Platform Independence

Nexora is an **independent, provider-neutral commerce platform**. Optional external compatibility and outbound integrations exist at explicit boundaries — Nexora does not depend on another commerce platform for core functionality.

## Source of truth

| Layer | Role |
| ----- | ---- |
| **PostgreSQL** | System of record for business data |
| **Nexora domain/application logic** | Business rules and state machines |
| **Nexora workers** | Async processing (outbox → BullMQ) |
| **Nexora events** | Cross-module reactions and integration triggers |
| **`/api/v1`** | Native product API |
| **`/api/v2`** | Optional external compatibility surface only |
| **Integration adapters** | Explicit outbound connections when a customer requires them |

Nexora must **not**:

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
                    │    Nexora APIs      │
                    │      /api/v1        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Nexora modules    │
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
Nexora public contracts
          │
          ▼
   Nexora core modules
          │
          ▼
      PostgreSQL
```

Compatibility translates external requests to Nexora operations against **Nexora's own database**. It does not call an external commerce API to fulfil native or compatibility reads/writes unless the feature is an **explicit outbound integration** (customer-connected external system).

## Independence test

For every compatibility feature:

> If the external platform disappeared permanently, could Nexora still perform this operation using its own database and business logic?

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

Native Nexora operation must not require external commerce platform configuration (`*_API_URL`, `*_API_KEY` for a specific provider in core config). Outbound provider credentials belong only inside an isolated integration boundary when explicitly required.

## Removability

Removing `src/modules/compatibility/` must not break Nexora core business modules. Core modules must compile and operate without importing compatibility. The composition root registers compatibility as an optional adapter — core factories do not depend on it.

See [module-boundaries.md](module-boundaries.md) for enforceable dependency rules and [compatibility.md](compatibility.md) for the `/api/v2` boundary.

## Related

- [ADR-018](../decisions/ADR-018-phase-5-merchant-compatible-scope.md) — Merchant-compatible scope
- [compatibility-matrix.md](compatibility-matrix.md) — endpoint scope and contract gaps
