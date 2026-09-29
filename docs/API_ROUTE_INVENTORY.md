# Nexora API Route Inventory

**Generated:** documentation audit (static scan of `*.routes.js` and `create-server.js`)
**Framework:** Fastify 5 + `fastify-type-provider-zod` + `@fastify/swagger` (OpenAPI 3.1)
**Main entry:** `src/app/main.js` → `createApplication()` → `createHttpServer()`

## Repository inspection (Phase 1)

| Topic | Finding |
| ----- | ------- |
| Runtime | Node (see `package.json` engines); **Fastify 5**, not Express |
| HTTP bootstrap | `src/app/http/create-server.js` registers plugins + domain `*.routes.js` |
| API prefixes | `/api/v1/*` (core), `/api/v2/*` (Merchant compatibility), `/api/v2/ce/*` (StockConnect CE) |
| Auth | `authentication.plugin.js` — JWT Bearer + `x-api-key`; public patterns for auth, tenants, webhooks, health, docs |
| Authorization | `authorization.plugin.js` + route-level permission checks in handlers |
| Validation | Zod via `fastify-type-provider-zod`; schemas in `presentation/*.schemas.js` |
| OpenAPI | `@fastify/swagger` + `jsonSchemaTransform`; UI `@scalar/fastify-api-reference` |
| Workers | BullMQ workers; separate observability HTTP in `worker-observability.routes.js` |

### Extended field reference (per Route ID)

| Ticket column | Where verified |
| ------------- | -------------- |
| Controller / handler | Inline handler or imported command in the matching `*.routes.js` |
| Middleware | Global plugins in `create-server.js`; auth skip via `PUBLIC_ROUTE_PATTERNS` |
| Path / query / body | Zod `schema` on the route definition in `*.routes.js` |
| Success / error responses | Zod response schemas + shared error schemas in route modules |

> OpenAPI is **auto-generated** from route Zod schemas where defined. When `DOCS_ENABLED=true`: Scalar UI at `/docs` (alias `/api-docs`), spec at `/openapi.json` and `/api-docs.json`.

## Summary counts

| Metric | Count |
| ------ | ----: |
| Route definitions in source (incl. duplicates across files) | 150 |
| **Unique registered endpoints (method + path, main HTTP server)** | **147** |
| DELETE endpoints | 3 |
| GET endpoints | 58 |
| PATCH endpoints | 9 |
| POST endpoints | 68 |
| PUT endpoints | 9 |
| Worker observability routes (separate listener) | 3 |

## Main application routes

| Route ID | Method | Full path | Route file | API module | Authentication | Registration | Swagger |
| -------- | ------ | --------- | ---------- | ---------- | -------------- | ------------ | ------- |
| R-0001 | GET | `/api-docs` | `src/app/http/create-server.js` | health-observability | public (when DOCS_ENABLED) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0002 | GET | `/api-docs.json` | `src/app/http/create-server.js` | health-observability | public (when DOCS_ENABLED) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0003 | GET | `/api/v1/api-keys` | `src/modules/api-keys/presentation/api-key.routes.js` | api-keys | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0004 | POST | `/api/v1/api-keys` | `src/modules/api-keys/presentation/api-key.routes.js` | api-keys | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0005 | POST | `/api/v1/api-keys/:apiKeyId/revoke` | `src/modules/api-keys/presentation/api-key.routes.js` | api-keys | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0006 | POST | `/api/v1/api-keys/:apiKeyId/rotate` | `src/modules/api-keys/presentation/api-key.routes.js` | api-keys | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0007 | GET | `/api/v1/audit` | `src/modules/audit/presentation/audit.routes.js` | audit | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0008 | POST | `/api/v1/auth/login` | `src/modules/identity/presentation/auth.routes.js` | auth | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0009 | POST | `/api/v1/auth/logout` | `src/modules/identity/presentation/auth.routes.js` | auth | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0010 | GET | `/api/v1/auth/me` | `src/modules/identity/presentation/auth.routes.js` | auth | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0011 | POST | `/api/v1/auth/refresh` | `src/modules/identity/presentation/auth.routes.js` | auth | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0012 | GET | `/api/v1/cancellations` | `src/modules/cancellations/presentation/cancellation.routes.js` | cancellations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0013 | POST | `/api/v1/cancellations` | `src/modules/cancellations/presentation/cancellation.routes.js` | cancellations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0014 | GET | `/api/v1/cancellations/:cancellationId` | `src/modules/cancellations/presentation/cancellation.routes.js` | cancellations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0015 | GET | `/api/v1/channels` | `src/modules/channels/presentation/channel.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0016 | POST | `/api/v1/channels` | `src/modules/channels/presentation/channel.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0017 | GET | `/api/v1/channels/:channelId` | `src/modules/channels/presentation/channel.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0018 | PATCH | `/api/v1/channels/:channelId` | `src/modules/channels/presentation/channel.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0019 | DELETE | `/api/v1/channels/:channelId/marketplace-connection` | `src/modules/channels/presentation/channel.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0020 | GET | `/api/v1/channels/:channelId/marketplace-connection` | `src/modules/channels/presentation/channel.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0021 | PATCH | `/api/v1/channels/:channelId/marketplace-connection` | `src/modules/channels/presentation/channel.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0022 | POST | `/api/v1/channels/:channelId/marketplace-connection` | `src/modules/channels/presentation/channel.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0023 | POST | `/api/v1/channels/:channelId/marketplace-connection/test` | `src/modules/channels/presentation/channel.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0024 | POST | `/api/v1/foundation/echo` | `src/app/http/routes/foundation.routes.js` | foundation | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0025 | GET | `/api/v1/foundation/ping` | `src/app/http/routes/foundation.routes.js` | foundation | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0026 | POST | `/api/v1/inbound/marketplace-webhooks/:ingressToken` | `src/modules/marketplace-webhook-ingestion/presentation/marketplace-webhook.routes.js` | marketplace-webhook-ingestion | webhook ingress token (marketplace adapter) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0027 | GET | `/api/v1/inventory` | `src/modules/inventory/presentation/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0028 | GET | `/api/v1/inventory/:productId` | `src/modules/inventory/presentation/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0029 | POST | `/api/v1/inventory/adjustments` | `src/modules/inventory/presentation/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0030 | POST | `/api/v1/inventory/receipts` | `src/modules/inventory/presentation/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0031 | POST | `/api/v1/inventory/releases` | `src/modules/inventory/presentation/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0032 | POST | `/api/v1/inventory/reservations` | `src/modules/inventory/presentation/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0033 | GET | `/api/v1/marketplaces` | `src/modules/marketplaces/presentation/marketplace.routes.js` | marketplaces | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0034 | POST | `/api/v1/marketplaces` | `src/modules/marketplaces/presentation/marketplace.routes.js` | marketplaces | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0035 | GET | `/api/v1/marketplaces/:id` | `src/modules/marketplaces/presentation/marketplace.routes.js` | marketplaces | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0036 | PATCH | `/api/v1/marketplaces/:id` | `src/modules/marketplaces/presentation/marketplace.routes.js` | marketplaces | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0037 | GET | `/api/v1/memberships/:membershipId/roles` | `src/modules/authorization/presentation/authorization.routes.js` | memberships | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0038 | POST | `/api/v1/memberships/:membershipId/roles` | `src/modules/authorization/presentation/authorization.routes.js` | memberships | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0039 | DELETE | `/api/v1/memberships/:membershipId/roles/:roleId` | `src/modules/authorization/presentation/authorization.routes.js` | memberships | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0040 | POST | `/api/v1/mfa/recovery-code/use` | `src/modules/mfa/presentation/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0041 | POST | `/api/v1/mfa/totp/activate` | `src/modules/mfa/presentation/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0042 | POST | `/api/v1/mfa/totp/start` | `src/modules/mfa/presentation/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0043 | POST | `/api/v1/mfa/totp/verify` | `src/modules/mfa/presentation/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0044 | POST | `/api/v1/mfa/verify` | `src/modules/mfa/presentation/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0045 | GET | `/api/v1/offers` | `src/modules/offers/presentation/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0046 | POST | `/api/v1/offers` | `src/modules/offers/presentation/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0047 | GET | `/api/v1/offers/:offerId` | `src/modules/offers/presentation/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0048 | PATCH | `/api/v1/offers/:offerId` | `src/modules/offers/presentation/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0049 | POST | `/api/v1/offers/:offerId/activate` | `src/modules/offers/presentation/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0050 | GET | `/api/v1/orders` | `src/modules/orders/presentation/order.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0051 | POST | `/api/v1/orders` | `src/modules/orders/presentation/order.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0052 | GET | `/api/v1/orders/:orderId` | `src/modules/orders/presentation/order.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0053 | POST | `/api/v1/orders/:orderId/cancel` | `src/modules/cancellations/presentation/cancellation.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0054 | POST | `/api/v1/orders/:orderId/confirm` | `src/modules/orders/presentation/order.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0055 | POST | `/api/v1/orders/:orderId/returns` | `src/modules/returns/presentation/return.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0056 | POST | `/api/v1/orders/:orderId/shipments` | `src/modules/shipments/presentation/shipment.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0057 | GET | `/api/v1/permissions` | `src/modules/authorization/presentation/authorization.routes.js` | permissions | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0058 | GET | `/api/v1/prices` | `src/modules/pricing/presentation/price.routes.js` | prices | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0059 | POST | `/api/v1/prices` | `src/modules/pricing/presentation/price.routes.js` | prices | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0060 | GET | `/api/v1/prices/:priceId` | `src/modules/pricing/presentation/price.routes.js` | prices | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0061 | PATCH | `/api/v1/prices/:priceId` | `src/modules/pricing/presentation/price.routes.js` | prices | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0062 | GET | `/api/v1/products` | `src/modules/products/presentation/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0063 | POST | `/api/v1/products` | `src/modules/products/presentation/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0064 | GET | `/api/v1/products/:productId` | `src/modules/products/presentation/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0065 | PATCH | `/api/v1/products/:productId` | `src/modules/products/presentation/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0066 | POST | `/api/v1/products/:productId/archive` | `src/modules/products/presentation/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0067 | GET | `/api/v1/products/:productId/content` | `src/modules/products/presentation/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0068 | PUT | `/api/v1/products/:productId/content/:locale` | `src/modules/products/presentation/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0069 | POST | `/api/v1/products/:productId/deactivate` | `src/modules/products/presentation/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0070 | GET | `/api/v1/returns` | `src/modules/returns/presentation/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0071 | GET | `/api/v1/returns/:returnId` | `src/modules/returns/presentation/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0072 | POST | `/api/v1/returns/:returnId/approve` | `src/modules/returns/presentation/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0073 | POST | `/api/v1/returns/:returnId/cancel` | `src/modules/returns/presentation/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0074 | POST | `/api/v1/returns/:returnId/complete` | `src/modules/returns/presentation/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0075 | POST | `/api/v1/returns/:returnId/receive` | `src/modules/returns/presentation/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0076 | POST | `/api/v1/returns/:returnId/reject` | `src/modules/returns/presentation/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0077 | GET | `/api/v1/roles` | `src/modules/authorization/presentation/authorization.routes.js` | roles | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0078 | POST | `/api/v1/roles` | `src/modules/authorization/presentation/authorization.routes.js` | roles | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0079 | GET | `/api/v1/shipments` | `src/modules/shipments/presentation/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0080 | GET | `/api/v1/shipments/:shipmentId` | `src/modules/shipments/presentation/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0081 | POST | `/api/v1/shipments/:shipmentId/cancel` | `src/modules/shipments/presentation/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0082 | POST | `/api/v1/shipments/:shipmentId/deliver` | `src/modules/shipments/presentation/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0083 | POST | `/api/v1/shipments/:shipmentId/ship` | `src/modules/shipments/presentation/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0084 | GET | `/api/v1/stock-locations` | `src/modules/inventory/presentation/inventory.routes.js` | stock-locations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0085 | POST | `/api/v1/stock-locations` | `src/modules/inventory/presentation/inventory.routes.js` | stock-locations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0086 | GET | `/api/v1/stock-locations/:stockLocationId` | `src/modules/inventory/presentation/inventory.routes.js` | stock-locations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0087 | POST | `/api/v1/tenants` | `src/modules/tenants/presentation/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0088 | GET | `/api/v1/tenants/:tenantId` | `src/modules/tenants/presentation/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0089 | POST | `/api/v1/tenants/:tenantId/close` | `src/modules/tenants/presentation/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0090 | POST | `/api/v1/tenants/:tenantId/reactivate` | `src/modules/tenants/presentation/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0091 | POST | `/api/v1/tenants/:tenantId/suspend` | `src/modules/tenants/presentation/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0092 | GET | `/api/v1/webhooks` | `src/modules/webhooks/presentation/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0093 | POST | `/api/v1/webhooks` | `src/modules/webhooks/presentation/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0094 | DELETE | `/api/v1/webhooks/:webhookId` | `src/modules/webhooks/presentation/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0095 | GET | `/api/v1/webhooks/:webhookId` | `src/modules/webhooks/presentation/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0096 | PATCH | `/api/v1/webhooks/:webhookId` | `src/modules/webhooks/presentation/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0097 | GET | `/api/v1/webhooks/:webhookId/deliveries` | `src/modules/webhooks/presentation/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0098 | GET | `/api/v1/webhooks/:webhookId/deliveries/:deliveryId` | `src/modules/webhooks/presentation/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0099 | POST | `/api/v1/webhooks/:webhookId/rotate-secret` | `src/modules/webhooks/presentation/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0100 | POST | `/api/v2/cancellations` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0101 | GET | `/api/v2/cancellations/merchant` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0102 | POST | `/api/v2/ce/cancellations` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0103 | GET | `/api/v2/ce/channels` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0104 | GET | `/api/v2/ce/channels/:channelId/products` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0105 | PUT | `/api/v2/ce/offer` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0106 | PUT | `/api/v2/ce/offer/stock` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0107 | GET | `/api/v2/ce/orders` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0108 | GET | `/api/v2/ce/orders/:merchantOrderNo/invoice` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0109 | POST | `/api/v2/ce/orders/acknowledge` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0110 | GET | `/api/v2/ce/products` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0111 | POST | `/api/v2/ce/products` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0112 | POST | `/api/v2/ce/products/bulkdelete` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0113 | PATCH | `/api/v2/ce/products/extra-data/bulk` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0114 | POST | `/api/v2/ce/products/freeze` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0115 | GET | `/api/v2/ce/returns` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0116 | PUT | `/api/v2/ce/returns` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0117 | POST | `/api/v2/ce/returns/merchant` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0118 | POST | `/api/v2/ce/returns/merchant/acknowledge` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0119 | POST | `/api/v2/ce/shipments` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0120 | PUT | `/api/v2/ce/shipments/:merchantShipmentNo/delivery-state` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0121 | GET | `/api/v2/ce/shipments/merchant` | `src/modules/compatibility/presentation/stockconnect-ce.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0122 | GET | `/api/v2/foundation/ping` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0123 | PUT | `/api/v2/offer` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0124 | PUT | `/api/v2/offer/stock` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0125 | GET | `/api/v2/orders` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0126 | POST | `/api/v2/orders` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0127 | POST | `/api/v2/orders/acknowledge` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0128 | POST | `/api/v2/orders/channel-fulfilled` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0129 | GET | `/api/v2/orders/new` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0130 | GET | `/api/v2/products` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0131 | POST | `/api/v2/products` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0132 | POST | `/api/v2/products/bulkdelete` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0133 | PATCH | `/api/v2/products/extra-data/bulk` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0134 | POST | `/api/v2/products/freeze` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0135 | POST | `/api/v2/returns` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0136 | PUT | `/api/v2/returns` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0137 | GET | `/api/v2/returns/merchant` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0138 | GET | `/api/v2/returns/merchant/:merchantOrderNo` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0139 | POST | `/api/v2/returns/merchant/acknowledge` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0140 | GET | `/api/v2/returns/merchant/new` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0141 | POST | `/api/v2/shipments` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0142 | PUT | `/api/v2/shipments/:merchantShipmentNo` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0143 | GET | `/api/v2/shipments/merchant` | `src/modules/compatibility/presentation/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0144 | GET | `/health/live` | `src/app/http/routes/health.routes.js` | health-observability | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0145 | GET | `/health/ready` | `src/app/http/routes/health.routes.js` | health-observability | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0146 | GET | `/internal/metrics` | `src/app/http/routes/metrics.routes.js` | metrics | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0147 | GET | `/openapi.json` | `src/app/http/create-server.js` | health-observability | public (when DOCS_ENABLED) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |

## Reconciliation notes

- Routes are registered in `src/app/http/create-server.js` via `app.register(moduleRoutes, deps)`.
- Compatibility registers **both** `compatibility.routes.js` and `stockconnect-ce.routes.js` (`/api/v2/*` and `/api/v2/ce/*`).
- `GET /openapi.json`, `GET /api-docs.json`, and `GET /api-docs` (redirect to `/docs`) are registered in `create-server.js` when `DOCS_ENABLED` is true.
- `GET /docs/*` is served by `@scalar/fastify-api-reference` when docs are enabled.
- Authentication plugin public routes: see `src/app/http/plugins/authentication.plugin.js` (`PUBLIC_ROUTE_PATTERNS`).
- CE routes accept query `apiKey` / `apikey` or header `X-CE-KEY` in addition to standard API key header.
- No unmounted `*.routes.js` files found under `src/modules` (all wired through `create-server.js` or worker bootstrap).

## Worker observability (conditional)

| Method | Path | File | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/health/live` | `src/workers/observability/worker-observability.routes.js` | Worker observability HTTP (separate process; not mounted on main API server) |
| GET | `/health/ready` | `src/workers/observability/worker-observability.routes.js` | Worker observability HTTP (separate process; not mounted on main API server) |
| GET | `/internal/metrics` | `src/workers/observability/worker-observability.routes.js` | Worker observability HTTP (separate process; not mounted on main API server) |

## UNRESOLVED

None from static scan. Runtime-only routes: none identified.

## OpenAPI reconciliation

Run `npm run docs:openapi-coverage` to compare this inventory against live `app.swagger()` output. Target: **147/147** operations matched (main HTTP server).

