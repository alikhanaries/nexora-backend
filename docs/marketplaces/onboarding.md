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

## Lifecycle worker delivery (Phase 43)

Inbound webhooks, polling-derived lifecycle commands, and optional outbound enqueue share one BullMQ queue (default name `marketplace-order-lifecycle`, override via `MARKETPLACE_LIFECYCLE_QUEUE_NAME`):

```text
Ingress (webhook HTTP / polling / outbound enqueue)
        ↓
MarketplaceLifecycleEnqueueService
        ↓
BullMQ job (deterministic job id from channel + marketplace + externalEventId + operation)
        ↓
ExecuteMarketplaceLifecycleJob (worker process)
        ↓
MarketplaceOrderLifecycleProcessor | MarketplaceOrderLifecycleService | ExecuteOutboundMarketplaceOrderLifecycleCommand
```

| Setting | Default |
| ------- | ------- |
| Queue name | `marketplace-order-lifecycle` |
| Job attempts | `QUEUE_DEFAULT_ATTEMPTS` (override `MARKETPLACE_LIFECYCLE_JOB_ATTEMPTS`) |
| Backoff | `QUEUE_BACKOFF_BASE_MS` (override `MARKETPLACE_LIFECYCLE_BACKOFF_MS`) |
| Worker concurrency | `QUEUE_WORKER_CONCURRENCY` |
| Job lock / timeout | `QUEUE_JOB_TIMEOUT_MS` |

Postgres idempotency remains authoritative for side effects (`marketplace-order-lifecycle.apply`, `marketplace-order-lifecycle/outbound`, webhook ingress route). Queue job ids coalesce duplicate enqueue only; they do not replace idempotency fingerprints.

Metrics: `marketplace_lifecycle_worker_jobs_total` (outcome, marketplace, operation, source) and existing `marketplace_order_lifecycle_total`.

### Testing

- Unit tests on the provider outbound adapter (mock client).
- `marketplace-outbound-lifecycle-adapter.contract.test.js` for registry adapters.
- `marketplace-outbound-order-lifecycle-provider-registration.test.js` keeps declared keys in sync with registration.
- Integration tests where the app exposes `executeOutboundMarketplaceOrderLifecycle` (Shopify integration suite; Amazon covered by unit tests with mocked SP-API).

### Registration

1. Implement `MarketplaceOutboundOrderLifecycleAdapter` under `infrastructure/adapters/<provider>/`.
2. Register in `register-marketplace-outbound-order-lifecycle-adapters.js`.
3. Add the marketplace key to `MARKETPLACE_OUTBOUND_ORDER_LIFECYCLE_PROVIDER_KEYS`.
4. Update `docs/marketplaces/order-lifecycle-matrix.md`.

## Current outbound providers

| Marketplace | Outbound operations |
| ----------- | ------------------- |
| Shopify | Cancel, refund, fulfill (Admin GraphQL) |
| Amazon | MFN fulfill (`confirmShipment` → generic `fulfill_order`) |
| Noon | MFN fulfill (`CreateShipment` → generic `fulfill_order`) |
| Namshi | FBPI fulfill (`CreateShipment` → generic `fulfill_order`) |

### Amazon outbound (Phase 40)

- Adapter: `AmazonOutboundOrderLifecycleAdapter` (`createFulfillment` only).
- API: `POST /orders/v0/orders/{orderId}/shipmentConfirmation` on `AmazonSpApiClient`.
- Map `MarketplaceCreateFulfillmentRequest` → confirmShipment body in `map-marketplace-fulfillment-to-amazon-confirm-shipment.js`.
- Generic `fulfill_order` only; `shipment_update` remains disabled (same SP-API can edit packages, but not exposed as a separate generic operation).
- Idempotency: Phase 39 Postgres idempotency route; `packageReferenceId` derived from lines + tracking for Amazon-side package identity.
- Limitations: MFN only; requires Amazon OrderItemId in `externalLineItemId`; FBA / Amazon Shipping label flows may fail at provider.

### Noon outbound (Phase 41)

- Adapter: `NoonOutboundOrderLifecycleAdapter` (`createFulfillment` only).
- API: `POST /fbpi/v1/shipment/create` on `NoonApiClient.createFbpiShipment`.
- Maps to generic **`fulfill_order`** (seller registers shipment + AWB with noon), not `shipment_update`.
- Auth: existing `NoonAuthSessionProvider` cookie session on authenticated requests.
- Partial fulfillment: include only the `mp_item_nr` lines being shipped; each line quantity must be `1`.
- Idempotency: Phase 39 Postgres route + deterministic `integration_shipment_nr`.
- Deferred: `CancelShipment` (not order cancel), `UpdateOrder`, `GetShipment`, returns/refunds.

### Namshi outbound (Phase 42)

- Adapter: `NamshiOutboundOrderLifecycleAdapter` (`createFulfillment` only).
- API: `POST /fbpi/v1/shipment/create` on `NamshiApiClient.createFbpiShipment` (Partners gateway; Namshi FBPI orders).
- Mapper: `map-marketplace-fulfillment-to-namshi-create-shipment.js`.
- Auth: `NamshiAuthSessionProvider` (same as catalog/order inbound).
- Maps to **`fulfill_order`** only; `shipment_update` not enabled separately.
- Partial fulfillment: subset of `mp_item_nr` lines; quantity `1` per line.
- Deferred: outbound cancel/refund/return/update; `GetShipment` / `CancelShipment` / `UpdateOrder`.
