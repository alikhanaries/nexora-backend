# StockConnect integration API

Versioned boundary at `/api/v2/stock-connect/*`. ChannelEngine compatibility remains at `/api/v2/ce/*` until migration is complete.

## Authentication

Create a **tenant API key** in Wasl (Settings → API keys). The secret is shown once and looks like:

`nxk_ab12cd34.<base64url-secret>`

Use the **full string** (prefix and secret, separated by a dot):

- `Authorization: Bearer nxk_ab12cd34.<secret>`
- `Authorization: ApiKey nxk_ab12cd34.<secret>` or `x-api-key: nxk_ab12cd34.<secret>`
- JWT Bearer (user access token from login) is also accepted on these routes

`STOCK_CONNECT_SERVICE_TOKEN` in Wasl `.env` is optional documentation for StockConnect’s own config; Wasl validates keys stored in the database, not that env var on inbound requests.
- Tenant scope is always derived from the verified credential; `X-Tenant-Id` must match the authenticated tenant or the request is rejected

## Feature flag

Set `STOCK_CONNECT_INTEGRATION_ENABLED=false` to hide the integration (404).

## OpenAPI

Static docs are served from `/openapi.json` (snapshot). StockConnect paths are documented in this file until the snapshot generator includes the integration tag **StockConnect Integration**.

### Endpoints

| Method | Path | Permission (typical API key scopes) |
| ------ | ---- | ----------------------------------- |
| GET | `/api/v2/stock-connect/ping` | any authenticated |
| GET | `/api/v2/stock-connect/products` | `products.read` |
| POST | `/api/v2/stock-connect/products` | `products.create` |
| GET | `/api/v2/stock-connect/products/:productId` | `products.read` |
| PATCH | `/api/v2/stock-connect/products/:productId` | `products.update` |
| POST | `/api/v2/stock-connect/products/:productId/publish` | `offers.create` / activate | 
| GET | `/api/v2/stock-connect/orders` | `orders.read` |
| GET | `/api/v2/stock-connect/orders/sync` | `orders.read` |
| GET | `/api/v2/stock-connect/orders/:orderId` | `orders.read` |
| POST | `/api/v2/stock-connect/orders/:orderId/cancel` | `orders.cancel` |
| GET | `/api/v2/stock-connect/inventory/:productId` | `inventory.read` |
| POST | `/api/v2/stock-connect/inventory/adjustments` | `inventory.update` |
| POST | `/api/v2/stock-connect/orders/:orderId/shipments` | `shipments.create` |
| GET | `/api/v2/stock-connect/shipments/:shipmentId` | `shipments.read` |
| POST | `/api/v2/stock-connect/shipments/:shipmentId/ship` | `shipments.update` |
| GET | `/api/v2/stock-connect/channels` | `channels.read` |

Mutations accept `Idempotency-Key` where applicable (publish, inventory adjust, shipment create, order cancel).

## Response envelope

```json
{
  "success": true,
  "integration": "stock-connect",
  "data": {}
}
```

List endpoints return `data.items`, `data.nextCursor`, and `data.hasMore`.

