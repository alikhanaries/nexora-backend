# External Compatibility Layer (`/api/v2`)

Nexora is an **independent commerce platform**. This document describes the optional **external compatibility boundary** — not a dependency on another platform. See [platform-independence.md](platform-independence.md).

Compatibility allows clients using a verified **external Merchant-compatible contract** to integrate via `/api/v2` while Nexora owns all business logic and persistence. Implementation path:

```
External request → compatibility mapper → Nexora public contract → Nexora core → PostgreSQL
```

**Not:**

```
External request → external platform API → external database
```

The adapter lives at `src/modules/compatibility/` (provider-neutral internally). Native product API remains `/api/v1`.

**Status:** Phase 5 — architectural boundary established (Steps A–B); Merchant-compatible endpoints not yet implemented.

## Three API surfaces

| Surface | Prefix | Contract | Purpose |
| ------- | ------ | -------- | ------- |
| **Nexora native** | `/api/v1` | Nexora schemas | Primary product API for new integrations |
| **Merchant-compatible** | `/api/v2` | Merchant API OpenAPI | Merchant poll/ack/ship/cancel/return flows |
| **Channel ingestion** | *Not in Phase 5 initial scope* | Channel API OpenAPI | Marketplace order ingestion — separate future decision |

External platform naming may exist **only** at the `/api/v2` presentation and mapper boundary where required by the verified public contract. Internal Nexora domain and application code must remain provider-neutral.

## Merchant API vs Channel API (verified)

These are **distinct contracts**. Do not conflate them.

### Merchant API (Phase 5 initial `/api/v2` scope)

Merchant-facing compatibility for integrators that poll and fulfil orders.

**Order operations defined:**

| Method | External path | Purpose |
| ------ | ------------- | ------- |
| GET | `/v2/orders` | List/filter orders |
| GET | `/v2/orders/new` | Orders with status **NEW** |
| POST | `/v2/orders/acknowledge` | Acknowledge order import |

**Not defined for order creation:**

| Method | External path | Notes |
| ------ | ------------- | ----- |
| POST | `/v2/orders` | **Does not exist** on Merchant API — must not be invented on Nexora `/api/v2` |

Other Merchant operations (shipments, cancellations, returns) are documented in the [compatibility matrix](compatibility-matrix.md) as future Merchant scope.

### Channel API (separate future scope)

Channel/marketplace order ingestion — **not** part of Phase 5 initial `/api/v2` scope.

| Method | External path | Purpose |
| ------ | ------------- | ------- |
| POST | `/v2/orders` | Create order (ingestion) |
| POST | `/v2/orders/channel-fulfilled` | Create channel-fulfilled order + shipment |

If Channel ingestion is added later, it requires an explicit product/architecture decision (see [ADR-018](../decisions/ADR-018-phase-5-merchant-compatible-scope.md)).

## Design intent

The compatibility layer is a **translation boundary**, not a second implementation of business logic.

```
External client (Merchant-compatible contract)
        │
        ▼
/api/v2/*  (compatibility/presentation)
        │  map external DTO ↔ Nexora public contract input/output
        ▼
modules/*/public/*  (query/command services)
        │
        ▼
modules/*/application → domain → infrastructure
```

Native API path (unchanged):

```
/api/v1/*  (core module presentation)
        ↓
core application → domain → infrastructure
```

### Rules

1. **No direct database access** from compatibility — `compatibility-no-direct-persistence`.
2. **Core modules must not import compatibility** — `core-no-compatibility`.
3. **Public contracts only** — `compatibility-no-module-index-imports`, `no-cross-module-internals`.
4. **No duplicated business rules** — state machines and invariants stay in core modules.
5. **Explicit mapping** — mappers in `compatibility/application/mappers/`.
6. **Error boundary** — core errors stay provider-neutral; compatibility maps to external HTTP responses.
7. **Authentication reuse** — API keys, JWT/principal, tenant context, authorization, rate limiting, audit.
8. **Tenant isolation** — tenant identity from authenticated principal only.
9. **Configuration** — central typed config only; no `process.env` in compatibility.
10. **Outbound integration** — outbox → BullMQ → handler → external adapter; no synchronous external calls from core modules.

## Module location

```
src/modules/compatibility/
  presentation/     Route handlers for /api/v2 (Merchant-compatible)
  application/
    mappers/        External ↔ Nexora representation translation
    errors/         Core error → external HTTP mapping
  domain/           External representation models (when needed)
  infrastructure/   Outbound adapters (future)
  public/           Exports for composition root and tests
  index.js          Module factory (dependency injection)
```

## Public contract usage

Compatibility depends on core **`public/`** contracts injected at the composition root (see `application/core-contracts.js`).

Example dependency chain for **Channel ingestion** (future, not Phase 5 initial scope):

```
Compatibility POST /api/v2/orders  (Channel contract — future)
    ↓
OrderCommandService.createOrder
    ↓
CreateOrder use case
```

Example for **Merchant acknowledgement** (future step):

```
Compatibility POST /api/v2/orders/acknowledge
    ↓
OrderCommandService (acknowledge operation — TBD on public contract)
    ↓
Orders application use case(s)
```

Compatibility must not import `create-order.js`, repositories, or SQL directly.

## Next endpoint candidate (not yet implemented)

The recommended **first Merchant endpoint** to implement is a **read**:

```
GET /api/v2/orders/new
```

This validates authentication, tenant context, query mapping, pagination translation, DTO mapping, and error mapping before mutation endpoints.

See [compatibility-matrix.md](compatibility-matrix.md) for public contract gaps that must be closed first.

## OpenAPI sources

| Contract | OpenAPI |
| -------- | ------- |
| Merchant API | `https://docs-new.channelengine.net/api/openapi/merchant.json` |
| Channel API | `https://docs-new.channelengine.net/api/openapi/channel.json` |

## Testing strategy (when implemented)

- **Contract tests** — golden external request/response samples per verified OpenAPI schema.
- **Matrix-driven coverage** — every matrix row marked planned/supported must have a contract test.
- **Architecture tests** — dependency-cruiser rules remain enforced.

## Parity tracking

Endpoint-by-endpoint status lives in [compatibility-matrix.md](compatibility-matrix.md).

## Related decisions

- [ADR-018](../decisions/ADR-018-phase-5-merchant-compatible-scope.md) — Phase 5 scope lock (resolves OQ-CE-001)
- [ADR-007](../decisions/ADR-007-channelengine-compatibility-layer.md) — original compatibility layer decision
- [ADR-010](../decisions/ADR-010-api-versioning.md) — URL versioning
- [module-boundaries.md](module-boundaries.md) — enforceable rules
