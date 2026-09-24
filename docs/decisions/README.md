# Architecture Decision Records

| ADR                                                     | Title                             | Status                |
| ------------------------------------------------------- | --------------------------------- | --------------------- |
| [ADR-001](ADR-001-modular-monolith.md)                  | Modular Monolith                  | Accepted              |
| [ADR-002](ADR-002-postgresql-source-of-truth.md)        | PostgreSQL Source of Truth        | Accepted / Phase 1    |
| [ADR-003](ADR-003-redis-infrastructure.md)              | Redis Infrastructure Layer        | Accepted / Phase 1    |
| [ADR-004](ADR-004-object-storage.md)                    | Object Storage                    | Accepted / Phase 1    |
| [ADR-005](ADR-005-transactional-outbox.md)              | Transactional Outbox              | Accepted / Phase 1    |
| [ADR-006](ADR-006-distributed-rate-limiting.md)         | Distributed Rate Limiting         | Accepted / Phase 1    |
| [ADR-007](ADR-007-channelengine-compatibility-layer.md) | ChannelEngine Compatibility Layer | Accepted / deferred   |
| [ADR-008](ADR-008-multi-tenancy.md)                     | Multi-Tenancy                     | Accepted / foundation |
| [ADR-009](ADR-009-audit-log-architecture.md)            | Audit Log Architecture            | Accepted / deferred   |
| [ADR-010](ADR-010-api-versioning.md)                    | API Versioning                    | Accepted              |
| [ADR-011](ADR-011-database-access.md)                   | Database Access (`pg`)            | Accepted / Phase 1    |
| [ADR-018](ADR-018-phase-5-merchant-compatible-scope.md) | Phase 5 Merchant-Compatible Scope | Accepted              |
| [ADR-019](ADR-019-phase-6-webhooks-events.md)         | Phase 6 Webhooks & Event Consumption | Accepted           |
| [ADR-020](ADR-020-phase-7-channel-inbound-integration.md) | Phase 7 Channel Inbound Integration | Accepted        |
| [ADR-021](ADR-021-external-id-mapping.md)                 | External Integer ID Mapping (Phase 8) | Accepted        |
| [ADR-022](ADR-022-phase-9-channel-default-stock-location.md) | Phase 9 Channel Default Stock Location | Accepted     |
| [ADR-023](ADR-023-phase-10-webhook-delivery-retention.md) | Phase 10 Webhook Delivery Retention | Accepted        |
| [ADR-024](ADR-024-phase-11-commerce-webhook-catalog.md) | Phase 11 Commerce Webhook Catalog | Accepted        |
| [ADR-025](ADR-025-phase-12-webhook-retry-after-scheduling.md) | Phase 12 Webhook Retry-After Scheduling | Accepted |
| [ADR-026](ADR-026-phase-13-worker-observability-http.md) | Phase 13 Worker Observability HTTP | Accepted |
| [ADR-027](ADR-027-phase-14-shipment-fulfillment-inventory.md) | Phase 14 Shipment Fulfillment Inventory | Accepted |
| [ADR-028](ADR-028-phase-15-catalog-sync-architecture.md) | Phase 15 Product, Inventory & Pricing Sync (architecture) | Accepted |
| [ADR-029](ADR-029-marketplace-connector-framework.md) | Phase 21 Marketplace Connector Framework | Accepted |
| [ADR-030](ADR-030-marketplace-connection-entity-mapping.md) | Phase 22 Connection & Entity Mapping Foundation | Accepted |

## Phase roadmap (architecture)

| Phase | Focus | ADR | Implementation |
| ----- | ----- | --- | -------------- |
| 14 | Shipment fulfillment inventory | ADR-027 | **Done** |
| 15 | Catalog sync architecture | ADR-028 | **Done** (spec) |
| 16–20 | Outbound catalog sync + reconciliation | ADR-028 §23 | **Done** (Nexora-side; stub adapter) |
| 21 | Marketplace connectors | ADR-029 | **Done** (branch) |
| 22 | Connection test metadata + entity mappings | ADR-030 | **Done** |
| 23 | Shopify production adapter | ADR-029 | **Done** (branch) |
| 24 | Amazon SP-API adapter | ADR-029 | **Done** (branch) |
| 27 | Adapter hardening | ADR-029 §8 | **Done** |
| 28 | Marketplace order ingestion framework | ADR-029 §11 | **Done** (branch) |

Add a new ADR only when a genuine architectural fork exists. Implementation details belong in module READMEs, not ADRs.
