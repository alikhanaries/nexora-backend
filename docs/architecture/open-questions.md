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

## Phase 7 — Channel inbound integration

| ID       | Question | Resolution |
| -------- | -------- | ---------- |
| OQ-7-01  | Channel API namespace — `/api/v2/orders` vs `/api/v2/channel/orders`? | **Resolved** — verified Channel paths on `/api/v2` ([ADR-020](../decisions/ADR-020-phase-7-channel-inbound-integration.md)) |
| OQ-7-02  | Native create `CONFIRMED` vs channel ingest `NEW`? | **Resolved** — dual semantics; native unchanged ([ADR-020](../decisions/ADR-020-phase-7-channel-inbound-integration.md)) |
| OQ-7-03  | Channel-fulfilled order/shipment/inventory semantics? | **Resolved** — auto-confirmed, no reserve, create+ship shipment ([ADR-020](../decisions/ADR-020-phase-7-channel-inbound-integration.md)) |
| OQ-7-04  | Product/line resolution hierarchy? | **Resolved** — SKU-first; public port gaps documented for 7.1 ([ADR-020](../decisions/ADR-020-phase-7-channel-inbound-integration.md)) |
| OQ-7-05  | Inventory reserve at ingest vs acknowledge? | **Resolved** — reserve at ingest for standard channel; skip for channel-fulfilled ([ADR-020](../decisions/ADR-020-phase-7-channel-inbound-integration.md)) |
| OQ-7-06  | Channel create response shape? | **Resolved** — mapped external order summary, not Merchant `{Success}` envelope ([ADR-020](../decisions/ADR-020-phase-7-channel-inbound-integration.md)) |
| OQ-7-07  | Default stock location for channel ingest lines? | **Open** — resolve in 7.2 via configurationReference convention or migration |

## Phase 8 — External integer ID mapping

| ID       | Question | Resolution |
| -------- | -------- | ---------- |
| OQ-8-01  | Integer allocation algorithm? | **Resolved** — PostgreSQL counter table with atomic upsert per `(tenant_id, provider, resource_type)` ([ADR-021](../decisions/ADR-021-external-id-mapping.md), migration `0042`) |
| OQ-8-02  | Is `OrderId` alone sufficient for acknowledge lookup? | **Open** — persistence supports lookup; Phase 8.3 |
| OQ-8-03  | Retain mapping rows after resource deletion? | **Resolved** — insert-only, no cascade delete ([ADR-021](../decisions/ADR-021-external-id-mapping.md)) |
| OQ-8-04  | Are compatibility integer IDs channel-scoped within a tenant? | **Resolved** — tenant-scoped per provider/resource type; channel column deferred ([ADR-021](../decisions/ADR-021-external-id-mapping.md)) |
| OQ-8-05  | `ChannelId` — mapping table vs `channels.external_reference`? | **Partially resolved** — inbound uses `channels.external_reference` (string); integer `ChannelId` outbound deferred to Phase 8.3 ([ADR-021](../decisions/ADR-021-external-id-mapping.md)) |
| OQ-8-06  | Backfill mappings for entities created before Phase 8? | **Open** — product decision before 8.4 |
| OQ-8-07  | Shared vs separate integer ID space for Merchant vs Channel API? | **Resolved** — shared `provider = compat_v2` ([ADR-021](../decisions/ADR-021-external-id-mapping.md)) |

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
