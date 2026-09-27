# Marketplace webhook ingestion (Phase 32)

Provider-neutral inbound webhook pipeline:

```text
POST /api/v1/inbound/marketplace-webhooks/:ingressToken
        ↓
Resolve connection (hashed ingress token → tenant/channel/marketplace)
        ↓
MarketplaceWebhookAdapter (provider-specific auth + normalization)
        ↓
Normalized marketplace webhook event
        ↓
Idempotency (deduplicationKey)
        ↓
MarketplaceOrderLifecycleProcessor → IngestNormalizedMarketplaceOrder
```

## Boundaries

- Generic services MUST NOT branch on `marketplace.key`.
- Provider signature verification and payload parsing live in webhook adapters only.
- No Shopify/Amazon/Noon/Namshi webhook adapters ship in Phase 32.

See [webhook-ingestion.md](../../../docs/marketplaces/webhook-ingestion.md).
