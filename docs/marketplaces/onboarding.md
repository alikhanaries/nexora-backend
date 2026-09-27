# Marketplace onboarding

How Nexora registers marketplace providers for catalog sync, order ingestion, webhooks, and order lifecycle.

## Registration surfaces

| Concern | Registry | Registration module |
| ------- | -------- | ------------------- |
| Order ingest / inbound lifecycle | `MarketplaceOrderAdapterRegistry` | `register-marketplace-order-adapters.js` |
| Webhook ingress | `MarketplaceWebhookAdapterRegistry` | `register-marketplace-webhook-adapters.js` |
| Outbound order lifecycle | `MarketplaceOutboundOrderLifecycleAdapterRegistry` | `register-marketplace-outbound-order-lifecycle-adapters.js` |

Declared provider keys for outbound lifecycle: `MARKETPLACE_OUTBOUND_ORDER_LIFECYCLE_PROVIDER_KEYS` in `src/modules/marketplaces/public/marketplace-outbound-order-lifecycle-providers.js`.

## Outbound lifecycle adapter (Phase 39)

Outbound mutations (cancel, refund, fulfill on the marketplace) use a separate path from inbound lifecycle:

```text
ExecuteOutboundMarketplaceOrderLifecycleCommand
  → capability check (outbound flags on adapter)
  → MarketplaceOutboundOrderLifecycleAdapter
  → provider HTTP client (GraphQL, REST, …)
  → normalized MarketplaceOutboundOrderLifecycleResult
```

### Capability declaration

Implement `getLifecycleCapabilities()` on the outbound adapter with:

- `supportsOutboundCancellation`
- `supportsOutboundRefund`
- `supportsOutboundFulfillment`
- `supportsOutboundReturns`

Only set a flag to `true` when the provider API semantics match the generic operation and the adapter method is implemented. The registry rejects operations when the flag is `false` or the adapter is missing.

### Provider API client

HTTP/auth stays in the provider client (e.g. `ShopifyGraphqlClient`, Amazon SP-API client). The outbound adapter maps generic requests to provider calls and maps responses/errors via `BaseMarketplaceOrderAdapter.runWithResult` / `mapMarketplaceErrorToAdapterError`.

### Request / response mapping

Keep mappers in the provider adapter directory (e.g. `shopify-order-lifecycle-adapter.js`, dedicated mapper modules). Do not branch on `marketplaceKey` in `ExecuteOutboundMarketplaceOrderLifecycleCommand`.

### Idempotency

Outbound commands use route id `marketplace-order-lifecycle/outbound` with caller-supplied `idempotencyKey` and a request fingerprint (`operation`, `externalOrderId`, `payload`). Duplicate keys replay the stored provider result without re-invoking the adapter.

### Retry handling

Adapter errors are classified into retryable vs permanent via existing catalog adapter error mapping. Workers own retry orchestration; provider clients should not multiply retries on top of worker/idempotency retries.

### Testing

- Unit tests on the provider outbound adapter (mock client).
- `marketplace-outbound-lifecycle-adapter.contract.test.js` for registry adapters.
- `marketplace-outbound-order-lifecycle-provider-registration.test.js` keeps declared keys in sync with registration.
- Integration tests where the app exposes `executeOutboundMarketplaceOrderLifecycle` (Shopify today).

### Registration

1. Implement `MarketplaceOutboundOrderLifecycleAdapter` under `infrastructure/adapters/<provider>/`.
2. Register in `register-marketplace-outbound-order-lifecycle-adapters.js`.
3. Add the marketplace key to `MARKETPLACE_OUTBOUND_ORDER_LIFECYCLE_PROVIDER_KEYS`.
4. Update `docs/marketplaces/order-lifecycle-matrix.md`.

## Current outbound providers

| Marketplace | Outbound operations |
| ----------- | ------------------- |
| Shopify | Cancel, refund, fulfill (Admin GraphQL) |
| Amazon | None registered (SP-API shipment confirmation not wired to generic fulfill/shipment) |
| Noon | None (FBPI outbound shipment/update not integrated) |
| Namshi | None (FBPI shipment create not exposed through outbound command) |
