# Noon marketplace catalog adapter (Phase 25)

Implements the generic `MarketplaceCatalogAdapter` against the [Noon Partners API](https://noon-docs.noonpartners.dev).

## Authentication

Service-account login (documented under Authentication → service accounts):

1. Build an **RS256 JWT** with claims `sub` = API key id, `iat`, and `jti`.
2. `POST {apiBaseUrl}/identity/public/v1/api/login` with JSON `{ token, default_project_code }`.
3. Store session **cookies** from the response; send them on subsequent calls with a mandatory **`User-Agent`** header.

Sessions are cached per connection (hash of key id + project + private key material). Tokens and private keys are never logged or returned from Nexora APIs.

## Connection configuration

| Field | Required | Description |
| ----- | -------- | ----------- |
| `configuration.countryCode` | yes | Marketplace country: `ae`, `sa`, or `eg` |
| `configuration.warehouseCode` | yes | Warehouse code for `UpdateStock` |
| `configuration.apiBaseUrl` | no | Override API host (default `https://noon-api-gateway.noon.partners`) |
| `configuration.userAgent` | no | Override User-Agent (default `Nexora/1.0` or `NOON_USER_AGENT`) |
| `configuration.projectCode` | no | Override project when not stored in credentials |

## Encrypted credentials (JSON)

| Field | Aliases | Description |
| ----- | ------- | ----------- |
| `keyId` | `key_id` | Service account key id (JWT `sub`) |
| `privateKey` | `private_key` | PEM private key for RS256 signing |
| `projectCode` | `project_code` | Default noon project code for login |

## Supported capabilities

| Capability | Noon API | Notes |
| ---------- | -------- | ----- |
| Connection test | `GET /identity/v1/whoami` | After login |
| Inventory sync | `POST /stock/v1/stock-update` | Absolute `qty` per `warehouse_code` + `partner_sku` |
| Price sync | `POST /pricing/v1/pricing/upsert` | `price` + `country_code`; does not recalculate Nexora pricing |
| Offer sync | `GET /offer/v1/product/{partner_sku}` | Mapping hints only when not deactivating |
| Activate | `POST /pricing/v1/pricing/upsert` | `is_active: true` (does not change price when omitted) |
| Deactivate | `POST /pricing/v1/pricing/upsert` | `is_active: false` (delist without clearing stock) |
| Product sync | — | **Unsupported** — catalog SKUs must exist in noon/Seller Lab first |

Generic `activate` → BatchUpsertPricing `is_active: true`.  
Generic `deactivate` → BatchUpsertPricing `is_active: false` (not delete, not zero stock).

## External entity mappings

| Type | Source |
| ---- | ------ |
| `noon_partner_sku` | Nexora `partner_sku` / offer external reference |
| `noon_offer` | `offer_code` from GetProductOffers when present |
| `noon_catalog_sku` | noon catalog `sku` field when returned |

## Inventory and price semantics

- **Inventory:** Nexora `availableQuantity` is sent as the absolute `qty` noon should hold (not a delta).
- **Price:** Nexora effective price (`amountMinor` / 100) is sent as `price` in local currency for `country_code`. MSRP is not synced (omitted).

## Errors, retries, throttling

HTTP status mapping uses the shared `MarketplaceHttpClient`. Batch APIs (`stock-update`, `pricing/upsert`) can return HTTP 200 with per-item failures; non-`OK` item statuses map to validation/not-found permanent errors.

Pricing rate limits (documented ~1500 req/min) surface as HTTP 429 → retryable catalog-sync jobs.

## Limitations / deferred

- **Product/catalog create** via Catalog API is not wired; Nexora does not yet supply noon catalog content payloads.
- **MSRP** and multi-country price rows beyond the configured `countryCode` are not synced.
- **Namshi** uses overlapping noon gateway patterns but remains a separate adapter (Phase 26).

## Order lifecycle (Phase 35)

Noon FBPI order lifecycle uses the generic marketplace lifecycle framework (Phase 31) and webhook ingress (Phase 32).

### Event Notifications

| Event | Direction | Nexora handling |
| ----- | --------- | --------------- |
| `FBPI::ORDER_SYNC` | Inbound webhook | `NoonWebhookAdapter` → `order.update` + `lifecyclePayload.noonEvent`; `GetFbpiOrder` before applying lifecycle |

Webhook envelope: `event_schema_version`, `event_type`, `metadata.message_id` (deduplication key), `payload.order_nr`.

### FBPI APIs (lifecycle)

| Operation | API | Phase 35 |
| --------- | --- | -------- |
| Read order | `GET /fbpi/v1/fbpi-order/{fbpi_order_nr}/get` | Yes — status sync / cancel detection |
| Mark out of stock | `POST` UpdateOrder | **Deferred** (not mapped to generic `update_order`) |
| Create shipment | `POST /fbpi/v1/shipment/create` | **Yes (Phase 41)** — outbound `fulfill_order` via `NoonOutboundOrderLifecycleAdapter` |
| Returns / refunds | — | **Unsupported** in Nexora lifecycle |

### Lifecycle capabilities

| Capability | Enabled | Notes |
| ---------- | ------- | ----- |
| `status_sync` | yes | From `mp_status` / `integration_status` on FBPI items |
| `cancel_order` | yes (inbound) | When all items are `MP_ITEM_STATUS_CANCELLED` |
| `fulfill_order` (outbound) | yes | CreateShipment with AWB + `mp_item_nr` lines |
| `update_order`, returns, refunds, outbound cancel, `shipment_update` | no | UpdateOrder / GetShipment / CancelShipment not wired; returns/refunds unsupported |

### Status mapping (item → order)

| Noon `mp_status` | Generic target |
| ---------------- | -------------- |
| `MP_ITEM_STATUS_CONFIRMED` | `confirmed` |
| `MP_ITEM_STATUS_CANCELLED` | `cancelled` |
| `MP_ITEM_STATUS_UNSPECIFIED` | `unknown` |

Shipped integration lines (`INTEGRATION_ITEM_STATUS_SHIPPED`) map to `unknown` until fulfillment executors exist. Partial cancellation across lines maps to `unknown`.

Authentication reuses the existing service-account session (`NoonApiClient` + `NoonAuthSessionProvider`).

### Outbound fulfillment (Phase 41)

`NoonOutboundOrderLifecycleAdapter.createFulfillment` maps generic `fulfill_order` to **CreateShipment** ([order flow](https://noon-docs.noonpartners.dev/docs/fbpi/setup/order-flow)).

| Generic field | Noon field |
| ------------- | ---------- |
| `externalOrderId` | `fbpi_order_nr` |
| `lines[].externalLineItemId` | `items[].mp_item_nr` (quantity must be `1` per line; partial shipments = subset of lines) |
| `trackingNumber` | `awbs[].awb_nr` |
| `carrier` | `awbs[].courier` |
| `configuration.warehouseCode` | `warehouse_code` |

`integration_shipment_nr` is derived deterministically (hashed lines + AWB). HTTP 200 with empty body → `providerReference` = `integration_shipment_nr`.

**Deferred:** `GetShipment`, `CancelShipment`, `UpdateOrder`, `AddShipmentCourierAwbs` (not mapped to generic lifecycle ops).

## Deployment env (optional)

See root `.env.example`: `NOON_API_BASE_URL`, `NOON_USER_AGENT`.
