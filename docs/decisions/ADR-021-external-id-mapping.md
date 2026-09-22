# ADR-021: External Integer ID Mapping (Phase 8)

**Status:** Accepted  
**Date:** 2026-09-22

## Context

Phases 5–7 delivered Nexora's Merchant- and Channel-compatible `/api/v2` adapter. The verified contracts use integer surrogate keys (`OrderId`, `ReturnId`, line `Id`, …) alongside merchant/channel string references. Phase 5–7 deliberately did not fabricate or persist external integer IDs ([compatibility-matrix.md](../architecture/compatibility-matrix.md)).

Nexora is an independent platform — compatibility endpoints translate to Nexora public contracts; they do not proxy to ChannelEngine ([ADR-018](ADR-018-phase-5-merchant-compatible-scope.md)).

## Problem

Compatibility integrators need stable integer IDs in responses and reliable integer → UUID lookup for inbound mutations. The UUID-centric domain must remain provider-neutral.

## Decision

Adopt **Option B**: a dedicated tenant-scoped **`external_integer_id_mappings`** table in module `src/modules/external-id-mapping/`, with public command/query ports deferred to Phase 8.2.

Rejected: integer columns on core tables (provider coupling), per-provider tables (duplication), reusing `external_reference` for CE integers (conflates merchant string keys with Nexora-assigned surrogates).

---

## Phase 8.1 implementation (completed)

### Mapping table

Table `external_integer_id_mappings`:

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | Row identity |
| `tenant_id` | uuid FK → `tenants` | RLS scope |
| `provider` | text | Initial: `compat_v2` (provider-neutral namespace for verified `/api/v2` contracts) |
| `resource_type` | text | `order`, `order_line`, `return`, `shipment`, `cancellation` |
| `resource_id` | uuid | Nexora entity UUID (polymorphic, app-enforced) |
| `external_id` | bigint | Assigned integer (> 0) |
| `created_at` | timestamptz | Insert-only |

Migration: `0042_external_integer_id_mappings.sql`.

### Allocation mechanism (OQ-8-01 — resolved)

**Decision:** PostgreSQL counter table `external_integer_id_sequences` with atomic upsert, mirroring `tenant_order_sequences` / `allocateOrderNumber`.

```sql
INSERT ... ON CONFLICT (tenant_id, provider, resource_type) DO UPDATE
  SET last_value = external_integer_id_sequences.last_value + 1
RETURNING last_value;
```

**Why not `MAX(id)+1`:** race-prone under concurrency.  
**Why not Redis:** unnecessary infrastructure; PostgreSQL is source of truth.  
**Why not a single global sequence:** namespace is `(tenant_id, provider, resource_type)`.

**Transaction / rollback:** Allocation and mapping insert run in the **caller's transaction**. Rollback of the caller transaction rolls back both the sequence bump and the mapping row — the same integer is re-issued on retry. **Sequence gaps** are acceptable when a transaction rolls back before commit; the compatibility contract does not require gapless IDs.

### Namespace model (OQ-8-04, OQ-8-07 — resolved)

**Tenant-scoped** integer space per `(tenant_id, provider, resource_type)`.

- Forward uniqueness: `(tenant_id, provider, resource_type, external_id)`
- Reverse uniqueness: `(tenant_id, provider, resource_type, resource_id)`
- Same integer **may** coexist across `resource_type` (order `1` and return `1`)
- **Channel-scoped allocation:** not used in Phase 8.1; schema has no `channel_id` column. Can be added later without rewriting mappings.

**Provider namespace:** Single provider value `compat_v2` covers both Merchant and Channel `/api/v2` contracts under one integer space per tenant/resource type (OQ-8-07). The value is provider-neutral in core/infrastructure; compatibility adapters map it to concrete contract semantics in Phase 8.3.

### Retention (OQ-8-03 — resolved)

Mappings are **insert-only identity records**. Rows are **not deleted** when parent resources are removed, preventing silent reassignment of previously issued external IDs. No FK from `resource_id` to polymorphic parent tables.

### Backfill (OQ-8-06 — deferred)

No backfill in Phase 8.1. Mappings are allocated only when Phase 8.2 creation flows invoke the repository.

### RLS

`external_integer_id_mappings`: `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy `tenant_id = app.current_tenant_id()`.

`external_integer_id_sequences`: no RLS (same pattern as `tenant_order_sequences`) — accessed only via repository with explicit `tenant_id` in the primary key.

### Repository (Phase 8.1)

`PostgresExternalIntegerIdMappingRepository`:

| Method | Purpose |
| ------ | ------- |
| `assignMapping(transaction, input)` | Allocate + insert (idempotent per `resource_id`) |
| `findResourceIdByExternalId(...)` | Forward lookup |
| `findExternalIdByResourceId(...)` | Reverse lookup |
| `findExternalIdsByResourceIds(...)` | Bounded batch reverse lookup |

Internal use case: `AssignExternalIntegerIdMapping` (used by public command service).

Constants: exported via `src/modules/external-id-mapping/public/index.js` (domain namespace).

### OQ-8-02 — OrderId-only acknowledge

Not implemented in 8.1/8.2. Persistence supports forward lookup for future Phase 8.3 validation.

---

## Phase 8.2 implementation (completed)

### Public contracts

| Service | Methods |
| ------- | ------- |
| `ExternalIntegerIdMappingCommandService` | `assignMapping(transaction, { tenantId, provider, resourceType, resourceId })` |
| `ExternalIntegerIdMappingQueryService` | `findResourceIdByExternalId`, `findExternalIdByResourceId`, `findExternalIdsByResourceIds` |

Repository remains module-internal. Wired via `createExternalIdMappingModule({ database })` in `create-application.js`.

### Creation wiring

External IDs (`provider = compat_v2`) are assigned inside the **same transaction** as resource creation in:

| Resource | Use case |
| -------- | -------- |
| `order`, `order_line` | `CreateOrder`, `CreateChannelOrder`, `CreateChannelFulfilledOrder` |
| `shipment` | `CreateShipment` (including channel-fulfilled nested path) |
| `cancellation` | `CreateCancellation` |
| `return` | `CreateReturn` |

Dedup/idempotent replay paths that return an existing resource without insert do not allocate new mappings. Idempotent HTTP replay relies on existing idempotency records — no duplicate mappings.

### OQ-8-05 — ChannelId vs `channels.external_reference`

**Finding:** `channels.external_reference` is the established tenant-scoped **string** channel key for inbound resolution (`X-Channel-Reference` header, `ChannelQueryService.getChannelByExternalReference`). Compatibility responses expose `ChannelReference` (string), not an integer `ChannelId`.

---

## Phase 8.3 implementation (completed)

### Outbound response enrichment

Compatibility read responses resolve external integer IDs through the public `ExternalIntegerIdMappingQueryService` (`provider = compat_v2`). Compatibility does **not** import repository implementations or execute mapping SQL directly.

| Resource | Response field | Lookup |
| -------- | -------------- | ------ |
| `order` | `Id` | `resourceType = order`, `resourceId = order.id` |
| `order_line` | `Lines[].Id` | `resourceType = order_line`, `resourceId = line.id` |
| `shipment` | `Id` | `resourceType = shipment`, `resourceId = shipment.id` |
| `cancellation` | `Id` | `resourceType = cancellation`, `resourceId = cancellation.id` |
| `return` | `Id` | `resourceType = return`, `resourceId = return.id` |

**Endpoints enriched:** `GET /api/v2/orders`, `GET /api/v2/orders/new`, `GET /api/v2/shipments/merchant`, `GET /api/v2/cancellations/merchant`, `GET /api/v2/returns/merchant`, `GET /api/v2/returns/merchant/new`, `GET /api/v2/returns/merchant/:merchantOrderNo`, and channel order create responses (`POST /api/v2/orders`, `POST /api/v2/orders/channel-fulfilled`).

**Batch lookups:** List endpoints collect UUIDs for the current page and call `findExternalIdsByResourceIds` once per resource type (no N+1 per entity).

**Missing mappings:** When no mapping row exists (e.g. resources created before Phase 8.2), the integer field is **omitted** from the JSON response. No fabricated IDs; no HTTP 500.

**ChannelId (OQ-8-05):** Verified outbound contracts use `ChannelReference` (string). Integer `ChannelId` is **not** implemented — no channel resource type in the mapping table. Remains a documented gap if a future contract revision requires it.

Core domain entities are unchanged — integer IDs live only in `external_integer_id_mappings`.

---

## Deferred (Phase 8.4+)

| Phase | Scope |
| ----- | ----- |
| **8.4** | Inbound integer ID resolution (`OrderId`, `ReturnId`, …); remove remaining documented limitations |
| **8.5** | Historical backfill for pre-Phase-8.2 resources; full integration verification |

---

## Related

- [ADR-007](ADR-007-channelengine-compatibility-layer.md)
- [ADR-018](ADR-018-phase-5-merchant-compatible-scope.md)
- [ADR-020](ADR-020-phase-7-channel-inbound-integration.md)
- [compatibility-matrix.md](../architecture/compatibility-matrix.md)
- [open-questions.md](../architecture/open-questions.md)
