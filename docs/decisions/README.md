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

Add a new ADR only when a genuine architectural fork exists. Implementation details belong in module READMEs, not ADRs.
