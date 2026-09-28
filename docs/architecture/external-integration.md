# External integration and ERP consumers

Nexora is a **consumer-neutral commerce platform**. External ERPs, OMS tools, and migration clients integrate through explicit **compatibility boundaries** — not by embedding consumer-specific logic in core modules.

## Layering

```text
External consumer (ERP A, ERP B, migration client, …)
        │
        ▼
Compatibility / adapter layer (`src/modules/compatibility/`, worker wiring)
        │
        ▼
Nexora public application services (orders, products, inventory, …)
        │
        ▼
Domain + PostgreSQL
```

Core modules (`orders`, `products`, `shipments`, `returns`, `marketplaces`, …) do **not** import compatibility code and do **not** branch on a named external consumer.

## HTTP compatibility surfaces

| Surface | Prefix | Role |
| ------- | ------ | ---- |
| Native API | `/api/v1` | Primary Nexora product API |
| Merchant-compatible | `/api/v2` | External merchant poll/ack/fulfil contract |
| Additional consumer contract | `/api/v2/ce/*` | Legacy-shaped routes for one current migration consumer; same adapter rules as `/api/v2` |

Route names and response field labels on these surfaces may match a **verified external contract**. That is intentional at the boundary only.

## Webhook payload strategies

Generic webhook delivery (subscription lookup, HMAC signing, retries, idempotency, SSRF checks) lives in `src/modules/webhooks/`.

**Payload formatting** is pluggable via `WebhookPayloadStrategy` (`webhook-payload-strategy.js`):

- Default: standard Nexora integration-event JSON envelope.
- Optional strategies: registered at the **worker composition root** (`wire-external-consumer-webhook-payload-strategies.js`) when a subscription profile requires an alternate body shape.

Adding a future ERP webhook format means registering another strategy — not changing order or shipment domain logic.

## External integer IDs

`external_integer_id_mappings` stores tenant-scoped integer identifiers per **provider namespace** (`ExternalIdMappingProvider`, e.g. `compat_v2` for the verified `/api/v2` merchant contract).

Additional provider values can be introduced for other external systems without redesigning core tables. Mappings are never shared across tenants.

## Configuration

Integration is **data-driven**:

- API keys (tenant-scoped, scoped permissions)
- Webhook subscriptions (URL, secret, event types, optional description/profile)
- Channels, marketplaces, credentials in tenant configuration

Nexora does not require consumer-specific environment variables for core operation.

## Production deployment readiness (Phase 60)

Nexora production readiness is **platform-level**. It does not require an external consumer to be online.

### Environment variables (application)

All variables are loaded only via `src/app/config` (see `.env.example`). Classifications:

| Area | Examples | Classification |
| ---- | -------- | -------------- |
| Runtime | `NODE_ENV`, `APP_NAME`, `APP_INSTANCE_NAMESPACE` | **REQUIRED** |
| HTTP | `SERVER_*` | **REQUIRED** (defaults in dev) |
| PostgreSQL | `DATABASE_URL`, pool/timeouts, optional `DATABASE_MIGRATION_URL` | **REQUIRED** / **SECRET** (credentials in URL) |
| Redis / queue | `REDIS_URL`, `QUEUE_REDIS_URL`, `QUEUE_*` | **REQUIRED** for API + workers |
| Object storage | `STORAGE_*` | **REQUIRED** for features using storage; readiness probe checks connectivity |
| Auth | `AUTH_JWT_*`, `AUTH_MFA_ENCRYPTION_KEY` | **REQUIRED** / **SECRET** |
| Webhooks worker | `WEBHOOK_DELIVERY_*` | **REQUIRED** when running delivery workers |
| Observability | `LOG_*`, `METRICS_*`, `OTEL_*` | **OPTIONAL** (tracing off by default) |
| Retention / catalog reconciliation | `*_RETENTION_*`, `CATALOG_SYNC_*` | **OPTIONAL** (commented defaults) |

No `STOCKCONNECT_*` or consumer-specific Nexora variables exist. Tenant integration (API keys, webhook URLs/secrets, channels) is **data-driven** in PostgreSQL.

### Health and readiness

| Endpoint | Purpose |
| -------- | ------- |
| `GET /health/live` | Process accepting traffic |
| `GET /health/ready` | Infrastructure + wiring checks |

Readiness probes (API process):

- `postgres`, `redis`, `queue`, `storage` — infrastructure connectivity
- `external_compat_ce_routes` — `/api/v2/ce/*` handlers wired at composition root (**no outbound HTTP**)
- `stockconnect_ce_compat` — legacy alias for the same wiring check (dashboard compatibility)

Readiness answers **“Can Nexora serve this capability?”**, not **“Is an external ERP reachable?”**.

Worker process exposes separate observability HTTP (`WORKER_OBSERVABILITY_*`) with postgres/redis/queue/worker registration checks.

### Security checklist (verified in code/tests)

- API key → tenant → authorization → domain service → tenant-scoped persistence
- CE routes: query `apiKey` / `apikey` / header `X-CE-KEY` isolated to `/api/v2/ce/*`
- Webhook HMAC, SSRF URL validation, sanitized destination logging, encrypted secrets
- Idempotency and webhook deliveries tenant-scoped
- External error responses do not leak stack traces or connection strings (see compatibility error mapper tests)

### Operational validation (environment — not application defects)

Before claiming production cutover for any external consumer:

1. Deploy Nexora API + worker with secrets and infra from `.env.example`.
2. Run migrations (`npm run migrate`).
3. Confirm `/health/ready` checks pass.
4. Configure tenant API keys and webhooks via Nexora APIs (no hardcoded IDs in code).
5. Run controlled E2E against the consumer’s staging environment.

Engineering status (Phases 57–59): **BUILD COMPLETE** for the established external contract; remaining work is **environment / deployment / E2E validation**.

## Related

- [platform-independence.md](platform-independence.md)
- [compatibility.md](compatibility.md)
- [compatibility-matrix.md](compatibility-matrix.md)
