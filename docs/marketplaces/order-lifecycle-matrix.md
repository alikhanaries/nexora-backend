# Marketplace order lifecycle matrix (Phases 31–39)

Authoritative summary of **implemented** lifecycle behavior. Legend:

- **In** = inbound only (webhook/poll → Nexora)
- **Out** = outbound only (Nexora → marketplace via `ExecuteOutboundMarketplaceOrderLifecycleCommand`)
- **Both** = implemented in both directions
- **—** = not implemented / not verified for generic contract

## Capability matrix

| Marketplace | Update | Cancel | Return | Refund | Fulfill | Shipment | Status sync |
| ----------- | -----: | -----: | -----: | -----: | ------: | -------: | ----------: |
| Amazon | — | In | — | — | — | — | In |
| Shopify | — | Both | — | Out | Out | — | In |
| Noon | — | In | — | — | — | — | In |
| Namshi | — | In | — | — | — | — | In |

## Outbound detail (Phase 39)

Generic entrypoint: `ExecuteOutboundMarketplaceOrderLifecycleCommand` + `MarketplaceOutboundOrderLifecycleAdapterRegistry`.

| Marketplace | Outbound ops | API | Notes |
| ----------- | ------------ | --- | ----- |
| Shopify | Cancel | Admin GraphQL `orderCancel` | OAuth access token via channel connection; idempotency route `marketplace-order-lifecycle/outbound` |
| Shopify | Refund | Admin GraphQL `refundCreate` | Line-level + optional shipping refund |
| Shopify | Fulfill | Admin GraphQL `fulfillmentCreate` | Requires fulfillment orders; tracking optional |
| Amazon | — | — | `confirmShipment` client exists; not registered—MFN shipment semantics vs generic `fulfill_order`/`shipment_update` not enabled |
| Noon | — | — | FBPI outbound (`UpdateOrder`, shipment create) not integrated |
| Namshi | — | — | FBPI `shipment/create` seller-initiated; not wired to outbound registry |

## Inbound idempotency keys

| Provider | Webhook deduplication | Lifecycle `externalEventId` |
| -------- | -------------------- | --------------------------- |
| Amazon | SNS / `NotificationId` | Notification id or composite |
| Shopify | `shopify:webhook:{x-shopify-webhook-id}` | Webhook id or status-sync from normalized order |
| Noon | `metadata.message_id` | Same as message id after `GetFbpiOrder` |
| Namshi | FBPI message id | After `GetFbpiOrder` enrichment |

## Application wiring

HTTP `createApplication` wires inbound lifecycle via `wireMarketplaceOrderIngestion` and outbound via `executeOutboundMarketplaceOrderLifecycle` (Shopify outbound adapter registered in bootstrap).

## Deferred

- Outbound `return_order` for all providers (Shopify returns not enabled—`supportsOutboundReturns: false`)
- Outbound `update_order`, `shipment_update` where provider semantics are not verified
- Amazon outbound shipment confirmation
- Noon/Namshi FBPI outbound shipment flows

Provider READMEs: `src/modules/marketplaces/infrastructure/adapters/{amazon,shopify,noon,namshi}/README.md`.
