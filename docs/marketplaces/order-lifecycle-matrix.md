# Marketplace order lifecycle matrix (Phases 31–37)

Authoritative summary of **implemented inbound lifecycle** behavior (`MarketplaceOrderAdapter` + webhook ingress). Outbound Shopify mutations use `ShopifyOrderLifecycleAdapter` (separate registry).

Legend: **In** = inbound only, **Out** = outbound only, **Both** = implemented in both directions where noted, **—** = not implemented.

| Marketplace | Update | Cancel | Return | Refund | Fulfill | Shipment | Status sync | Events | Polling |
| ----------- | -----: | -----: | -----: | -----: | ------: | -------: | ----------: | -----: | ------: |
| Amazon | — | In | — | — | — | — | In | In (SNS `ORDER_CHANGE`) | In (`getOrder`) |
| Shopify | — | In + Out | — | Out | Out | — | In | In (Admin webhooks) | In (GraphQL poll) |
| Noon | — | In | — | — | — | — | In | In (`FBPI::ORDER_SYNC`) | In (`GetFbpiOrder`) |
| Namshi | — | — | — | — | — | — | — | — | — |

## Idempotency keys (inbound)

| Provider | Webhook deduplication | Lifecycle `externalEventId` |
| -------- | -------------------- | --------------------------- |
| Amazon | SNS / `NotificationId` | Notification id or composite |
| Shopify | `shopify:webhook:{x-shopify-webhook-id}` | Webhook id or status-sync from normalized order |
| Noon | `metadata.message_id` | Same as message id after `GetFbpiOrder` |

## Application wiring

HTTP `createApplication` wires `processMarketplaceLifecyclePayload` and `marketplaceOrderLifecycleService` when order repositories and command services are configured (see `wireMarketplaceOrderIngestion`).

## Deferred (all providers)

- Generic executors for `return_order`, inbound `refund_order`, inbound `fulfill_order`, `shipment_update` where not listed above
- Namshi order lifecycle adapter (catalog only today)
- Noon outbound FBPI (`UpdateOrder`, `CreateShipment`)
- Amazon outbound shipment confirmation

Provider READMEs: `src/modules/marketplaces/infrastructure/adapters/{amazon,shopify,noon}/README.md`.
