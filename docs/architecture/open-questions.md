# Open Questions

Unresolved design items tracked across phases. Move to an ADR when decided.

## Authentication and authorization

| ID     | Question                                                         | Impact                         | Owner | Target phase |
| ------ | ---------------------------------------------------------------- | ------------------------------ | ----- | ------------ |
| OQ-001 | JWT vs opaque session tokens vs API keys for first auth release? | API middleware design          | TBD   | Phase 2      |
| OQ-002 | Single tenant per API key or multi-tenant keys with header?      | Tenant context wiring          | TBD   | Phase 2      |
| OQ-003 | RBAC model — roles per tenant vs global admin?                   | Permission checks in use cases | TBD   | Phase 2      |

## Multi-tenancy

| ID     | Question                                                        | Impact               | Owner | Target phase |
| ------ | --------------------------------------------------------------- | -------------------- | ----- | ------------ |
| OQ-010 | Shared schema + RLS vs schema-per-tenant for largest customers? | Migration complexity | TBD   | Phase 2      |
| OQ-011 | When tenant GUC is unset, fail closed on all domain queries?    | Security default     | TBD   | Phase 2      |

## ChannelEngine compatibility

| ID     | Question                                                           | Impact              | Owner   | Target phase |
| ------ | ------------------------------------------------------------------ | ------------------- | ------- | ------------ |
| OQ-020 | Full ChannelEngine OpenAPI import for matrix population?           | Compatibility scope | TBD     | Phase 2      |
| OQ-021 | Support ChannelEngine webhook callbacks or polling-only initially? | Integration pattern | TBD     | Phase 2      |
| OQ-022 | Which CE endpoints are mandatory for launch vs nice-to-have?       | Prioritisation      | Product | Phase 2      |

## Events and integrations

| ID     | Question                                                            | Impact             | Owner | Target phase |
| ------ | ------------------------------------------------------------------- | ------------------ | ----- | ------------ |
| OQ-030 | Outbox published-event retention period?                            | Table growth       | **Resolved** | Phase 6.6 (`OUTBOX_RETENTION_DAYS`, see [events.md](events.md)) |
| OQ-031 | External webhook delivery — outbox consumer or separate dispatcher? | Architecture       | **Resolved** | Phase 6 ([ADR-019](../decisions/ADR-019-phase-6-webhooks-events.md)) |
| OQ-032 | Event schema registry (JSON Schema / Avro)?                         | Consumer contracts | TBD   | Phase 3      |

## Audit and compliance

| ID     | Question                                          | Impact        | Owner | Target phase |
| ------ | ------------------------------------------------- | ------------- | ----- | ------------ |
| OQ-040 | Audit log retention period (regulatory)?          | Storage cost  | Legal | Phase 2      |
| OQ-041 | SIEM integration target (Splunk, Datadog, other)? | Export format | Ops   | Phase 3      |

## Operations

| ID     | Question                                                             | Impact               | Owner | Target phase |
| ------ | -------------------------------------------------------------------- | -------------------- | ----- | ------------ |
| OQ-050 | Managed PostgreSQL provider (RDS, Cloud SQL, Aurora)?                | Connection tuning    | Ops   | Pre-prod     |
| OQ-051 | Separate Redis clusters for cache vs queue in staging?               | Cost vs fidelity     | Ops   | Pre-prod     |
| OQ-052 | Kubernetes vs container service vs PaaS for first production deploy? | Deployment manifests | Ops   | Pre-prod     |

## Resolved (for reference)

| ID  | Decision                                | ADR                                                           |
| --- | --------------------------------------- | ------------------------------------------------------------- |
| —   | Modular monolith                        | [ADR-001](../decisions/ADR-001-modular-monolith.md)           |
| —   | PostgreSQL source of truth              | [ADR-003](../decisions/ADR-003-postgresql-source-of-truth.md) |
| —   | Raw SQL via `pg`                        | [ADR-011](../decisions/ADR-011-database-access.md)            |
| —   | Native `/api/v1`, CE `/api/v2` deferred | [ADR-010](../decisions/ADR-010-api-versioning.md)             |
| OQ-031 | Webhook delivery uses composite router on `integration-events`, with HTTP on separate `webhook-deliveries` queue | [ADR-019](../decisions/ADR-019-phase-6-webhooks-events.md) |
