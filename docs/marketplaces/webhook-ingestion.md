# Marketplace webhook ingestion (Phase 32)

## Flow

```text
Marketplace HTTPS POST
        ↓
/api/v1/inbound/marketplace-webhooks/:ingressToken
        ↓
app.lookup_marketplace_connection_for_webhook (SECURITY DEFINER)
        ↓
MarketplaceWebhookAdapter.authenticateWebhookRequest
        ↓
MarketplaceWebhookAdapter.normalizeWebhookEvent
        ↓
Normalized marketplace webhook event (Zod)
        ↓
Postgres idempotency (deduplicationKey)
        ↓
MarketplaceOrderLifecycleProcessor
        ↓
IngestNormalizedMarketplaceOrder → CreateChannelOrder
```

## Ingress token

Nexora-issued opaque token in the URL identifies the active `marketplace_connections` row. Only a SHA-256 hash is stored (`webhook_ingress_token_hash`). This is **routing**, not provider signature verification.

Provider authenticity is enforced only inside the registered `MarketplaceWebhookAdapter` for that `marketplaces.key`.

## Adapter contract

See `src/modules/marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js`.

Phase 32 ships **no** Shopify/Amazon/Noon/Namshi webhook adapters. Unsupported providers return `422` with explicit capability errors.

## Idempotency

| Field | Value |
| ----- | ----- |
| `routeId` | `POST /api/v1/inbound/marketplace-webhooks/:ingressToken` |
| `principalFingerprint` | `marketplace-webhook:{connectionId}` |
| `idempotencyKey` | normalized event `deduplicationKey` |
| `tenantId` | connection tenant |

Duplicate deliveries replay the stored HTTP body without re-running ingestion.

## Observability

Counter `marketplace_webhook_total` with labels `outcome`, `marketplace`, `operation`. No PII or secrets in logs.

## Deferred

- Provider webhook implementations (Phase 33+)
- Order update/cancel webhook kinds (explicitly unsupported in lifecycle processor today)
- Automatic ingress token issuance on connection upsert (operators set hash via API follow-up)
