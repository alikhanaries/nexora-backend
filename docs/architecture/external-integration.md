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

## Related

- [platform-independence.md](platform-independence.md)
- [compatibility.md](compatibility.md)
- [compatibility-matrix.md](compatibility-matrix.md)
