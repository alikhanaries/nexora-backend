# ADR-030: Marketplace Connection & Entity Mapping Foundation (Phase 22)

**Status:** Accepted  
**Date:** 2026-09-24  
**Phase:** 22 — production-ready generic connections + entity mappings

## 1. Context

[ADR-029](ADR-029-marketplace-connector-framework.md) introduced tenant-scoped `marketplace_connections`, encrypted credentials, catalog adapters, and the `marketplace_entity_mappings` **schema** without a persistence service or mapping write path from catalog sync.

Phase 22 hardens the **generic foundation** so provider phases (23–26) can focus on API completion, not core wiring.

## 2. Goals

- **Connection lifecycle** with audit events, last-test metadata (no secrets), and channel/tenant ownership checks
- **Entity mapping persistence** with PostgreSQL uniqueness and RLS (already on tables from Phase 21)
- **Repository boundary** for mappings (find by Nexora entity, find by external entity, upsert, delete)
- **Optional mapping capture** after successful adapter sync when the adapter returns an external identifier (never invented)
- **Secret redaction** in logs, API responses, audit metadata, and connection test errors
- **Provider-neutral core** — no marketplace-key branching in commerce or catalog-sync orchestration

## 3. Non-goals

- New Shopify/Amazon/Noon/Namshi API behavior (Phases 23–26)
- Inbound catalog import or order ingestion
- Replacing `external_integer_id_mappings` (ADR-021) — marketplace string IDs remain in `marketplace_entity_mappings`
- High-cardinality audit for every catalog sync HTTP call

## 4. Connection ownership

| Concern | Rule |
| ------- | ---- |
| Scope | One **active** connection per `(tenant_id, channel_id, marketplace_key)` |
| Channel | Connection always tied to a Nexora channel; marketplace key derived from channel’s marketplace record on create |
| Credentials | Encrypted via `SecretEncryptorPort`; decrypted only inside adapter runtime at job execution or connection test |
| HTTP | Generic routes under `/api/v1/channels/:channelId/marketplace-connection` only |
| Test | `adapter.testConnection(runtime)`; outcome stored as `last_test_outcome` / sanitized `last_test_error` |

## 5. Entity mapping model

Direction: **Nexora entity → marketplace external identifier** (outbound sync).

| Field | Purpose |
| ----- | ------- |
| `tenant_id`, `channel_id`, `marketplace_key` | Isolation (same as connection scope) |
| `nexora_entity_type` | `product`, `offer`, `stock_location` (extensible via check constraint migration if needed) |
| `nexora_entity_id` | Nexora UUID |
| `external_entity_type` | Adapter-defined string (e.g. `shopify_product_variant`, `amazon_listing_sku`) |
| `external_entity_id` | Opaque provider string |

**Uniqueness:** one mapping per Nexora entity per channel/marketplace; one external id per channel/marketplace/external type (prevents duplicate external listings).

**Idempotency:** upsert on conflict updates external ids when the provider returns a new identifier for the same Nexora entity.

## 6. Adapter ownership

- Adapters declare capabilities via `getCapabilities()`.
- Unsupported operations map to permanent/unsupported errors (Phase 21).
- Adapters **may** return optional `MarketplaceCatalogSyncMappingHint[]` from sync methods; orchestration persists via `MarketplaceEntityMappingRecorder` port only when hints are present.
- Foundation stub returns no hints.

## 7. Security

- No plaintext credentials in PostgreSQL
- No credentials in BullMQ payloads, domain/integration events, metrics labels, or API JSON
- Connection test errors truncated and scanned for obvious secret patterns before persistence
- Tenant RLS on connection and mapping tables
- Composite FK `(tenant_id, channel_id) → channels` added in migration 0046

## 8. Audit

Connection command service records (when `auditRecorder` configured):

- `MARKETPLACE_CONNECTION_CREATED`
- `MARKETPLACE_CONNECTION_UPDATED`
- `MARKETPLACE_CONNECTION_DISABLED`
- `MARKETPLACE_CONNECTION_TESTED` (success/failure metadata only, no credentials)

## 9. Migration strategy

- **Do not edit** applied migrations.
- Phase 21 `0045` remains; **0046** adds FKs, connection test columns, and external-id uniqueness index.

## 10. Related

- [ADR-029](ADR-029-marketplace-connector-framework.md)
- [ADR-028](ADR-028-phase-15-catalog-sync-architecture.md)
- [ADR-021](ADR-021-external-id-mapping.md)
