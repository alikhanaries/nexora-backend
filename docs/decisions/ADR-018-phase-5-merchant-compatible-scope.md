# ADR-018: Phase 5 Merchant-Compatible API Scope

**Status:** Accepted  
**Date:** 2026-09-21

## Context

OpenAPI verification resolved **OQ-CE-001**. The external platform publishes two distinct contracts that share `/v2` path prefixes but serve different integration roles:

| Contract | Role |
| -------- | ---- |
| **Merchant API** | Merchant-facing reads and fulfilment mutations (poll orders, acknowledge, ship, cancel, return) |
| **Channel API** | Channel/marketplace order ingestion (`POST /v2/orders`, channel-fulfilled orders) |

Nexora `/api/v2` must not silently blend these contracts into a hybrid surface. Internal architecture remains provider-neutral (`src/modules/compatibility/`).

Nexora is an **independent platform** — compatibility endpoints translate to Nexora public contracts and PostgreSQL. They do not proxy to or depend on an external commerce platform for business truth. See [platform-independence.md](../architecture/platform-independence.md).

## Decision

### Phase 5 `/api/v2` scope

Nexora `/api/v2` will initially implement the **Merchant-compatible compatibility surface** only.

1. **`/api/v2/orders` is not an order-creation endpoint** in the initial Merchant-compatible surface. The Merchant OpenAPI defines `GET /v2/orders`, `GET /v2/orders/new`, and `POST /v2/orders/acknowledge` — not `POST /v2/orders`.
2. **No hybrid semantics** — path parity follows the verified Merchant contract; Channel ingestion paths are not repurposed.
3. **Initial order compatibility scope** — Merchant order reads and acknowledgement.
4. **Subsequent Merchant scope** — shipments, cancellations, returns, and other Merchant mutations per the verified Merchant OpenAPI, implemented in later Phase 5 steps.
5. **Channel ingestion is separate future scope** — `POST /v2/orders` and `POST /v2/orders/channel-fulfilled` belong to the Channel API contract and require an explicit future product decision before implementation (potentially a separate route namespace or documented extension — not Phase 5 initial scope).

### Implementation rules (unchanged)

- Compatibility integrates with core modules only through **`public/` contracts**.
- Core modules must never import compatibility.
- Compatibility must not access repositories, PostgreSQL infrastructure, or private application use cases.
- External field names and status values appear only at the compatibility presentation/mapper boundary.

## Consequences

**Positive**

- Clear contract boundary for migration clients (Merchant integrators).
- Avoids inventing a non-standard `POST /api/v2/orders` create endpoint.
- Channel/marketplace ingestion can be scoped independently later.

**Negative**

- Clients expecting Channel-style order ingestion on `/api/v2` are not served in Phase 5 initial scope.
- Status, pagination, and identifier mapping work remains before the first Merchant read endpoint ships.

## Related

- [compatibility.md](../architecture/compatibility.md)
- [compatibility-matrix.md](../architecture/compatibility-matrix.md)
- [ADR-007](ADR-007-channelengine-compatibility-layer.md) — original compatibility layer decision
- [ADR-010](ADR-010-api-versioning.md) — `/api/v1` vs `/api/v2` versioning
