# Amazon SP-API marketplace adapter (Phase 24)

Production adapter for `MarketplaceCatalogAdapter` using **Login with Amazon (LWA)** and **AWS Signature Version 4** against Selling Partner API.

## Credentials (encrypted on `marketplace_connections`)

| Field | Purpose |
| ----- | ------- |
| `clientId` | LWA application client identifier |
| `clientSecret` | LWA client secret |
| `refreshToken` | LWA refresh token |
| `sellerId` | Selling partner ID (merchant token) |
| `awsAccessKeyId` | IAM user access key for SP-API signing |
| `awsSecretAccessKey` | IAM secret key |
| `awsSessionToken` | Optional STS session token |

## Connection configuration

| Field | Purpose |
| ----- | ------- |
| `marketplaceId` | Amazon marketplace id (e.g. `ATVPDKIKX0DER`) — **required** |
| `region` | SP-API endpoint group: `na` (default), `eu`, `fe` |
| `awsRegion` | Optional override for SigV4 region (defaults from `region`) |
| `listingsProductType` | Listings Items `productType` (default `PRODUCT`) |
| `lwaTokenUrl` | Optional LWA token endpoint override |

Deployment may set `AMAZON_LWA_TOKEN_URL` in environment config (see `.env.example`).

## Capabilities

| Operation | Mechanism |
| --------- | --------- |
| Connection test | `GET /sellers/v1/marketplaceParticipations` (signed) |
| Inventory sync | Listings Items `PATCH` → `/attributes/fulfillment_availability` |
| Price sync | Listings Items `PATCH` → `/attributes/purchasable_offer` |
| Product / offer sync | Deactivate → quantity `0` on fulfillment availability (not delete) |
| Activate | Mapping hint only; inventory/price jobs supply quantities and offers |

## Entity mappings

- `amazon_listing` — Nexora product/offer → seller SKU (from `offer.externalReference` or `merchantSku`)

## Authentication architecture

- **LWA:** `AmazonLwaTokenProvider` (connection-scoped in-memory cache, SHA-256 cache key)
- **SigV4:** `AwsSigV4RequestSigner` (`execute-api` service) — reusable for other signed providers
- **Transport:** generic `MarketplaceHttpClient` (no Amazon branches)

## Order lifecycle (Phase 34)

Uses the generic marketplace order lifecycle framework (Phase 31) and webhook ingress (Phase 32).

| Generic operation | Amazon support | Mechanism |
| ----------------- | -------------- | --------- |
| `status_sync` | Yes | `ORDER_CHANGE` notification → map `Summary.OrderStatus`; optional `GET /orders/v0/orders/{orderId}` polling |
| `cancel_order` | Yes (inbound) | `BuyerRequestedChange` / `Canceled` status → generic cancellation |
| `update_order` | No | Amazon orders are not arbitrarily mutable via Orders API |
| `return_order` / `refund_order` | No | Not implemented in Phase 34 (no direct mutation API wired) |
| `fulfill_order` | Yes (outbound, MFN) | `POST /orders/v0/orders/{orderId}/shipmentConfirmation` via `AmazonOutboundOrderLifecycleAdapter` |
| `shipment_update` | No | Same SP-API operation can edit packages, but generic `shipment_update` is not enabled separately (use `fulfill_order` / confirmShipment for MFN packages) |

### Notifications

Amazon delivers SP-API notifications through **SNS**. Nexora’s marketplace webhook endpoint expects the **SNS HTTPS POST body** (Type `Notification`, JSON `Message` containing the SP-API notification). `NotificationMetadata.NotificationId` is the lifecycle/webhook deduplication key.

SNS subscription confirmation must be completed outside Nexora before events arrive.

### Orders API (read / outbound)

| Operation | SP-API |
| --------- | ------ |
| Read order | `GET /orders/v0/orders/{orderId}` |
| Confirm shipment (MFN outbound) | `POST /orders/v0/orders/{orderId}/shipmentConfirmation` |

### Outbound fulfillment (Phase 40)

`AmazonOutboundOrderLifecycleAdapter.createFulfillment` maps generic `fulfill_order` to **confirmShipment** for merchant-fulfilled (MFN) orders.

| Generic field | Amazon field |
| ------------- | ------------ |
| `externalOrderId` | Path `{orderId}` (AmazonOrderId) |
| `lines[].externalLineItemId` | `packageDetail.orderItems[].orderItemId` |
| `lines[].quantity` | `packageDetail.orderItems[].quantity` |
| `trackingNumber` | `packageDetail.trackingNumber` (required) |
| `carrier` | `packageDetail.carrierCode` (required) |
| Connection `configuration.marketplaceId` | Body `marketplaceId` |
| Optional `configuration.shipFromSupplySourceId` | `packageDetail.shipFromSupplySourceId` |

`packageReferenceId` is derived deterministically from line items + tracking (supports partial shipments via line quantities; multiple packages require separate outbound calls with distinct line/tracking combinations).

**Not supported outbound:** seller-initiated cancel, refund, return, order update. **FBA** and Amazon-purchased shipping labels may reject confirmShipment—treat as permanent provider errors.

Authentication: existing LWA + SigV4 on `AmazonSpApiClient` (no new token store).

Authentication reuses LWA + SigV4 from catalog (`AmazonSpApiClient`).

## Limitations

- Does **not** create new Amazon catalog listings or ASINs — SKU must already exist in Seller Central / Listings API.
- No product title, browse node, variation theme, or attribute catalog sync (not on Nexora catalog sync port).
- Offer **activate** does not restore stock levels; run inventory sync after activation.
- Noon/Namshi are separate adapters.

See [ADR-029](../../../../../docs/decisions/ADR-029-marketplace-connector-framework.md).
