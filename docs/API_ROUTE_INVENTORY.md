# Wasl API Route Inventory

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
| Route definitions in source (incl. duplicates across files) | 142 |
| **Unique registered endpoints (method + path, main HTTP server)** | **142** |
| DELETE endpoints | 3 |
| GET endpoints | 54 |
| PATCH endpoints | 9 |
| POST endpoints | 67 |
| PUT endpoints | 9 |
| Worker observability routes (separate listener) | 3 |

## Main application routes

| Route ID | Method | Full path | Route file | API module | Authentication | Registration | Swagger |
| -------- | ------ | --------- | ---------- | ---------- | -------------- | ------------ | ------- |
| R-0001 | GET | `/api/v1/api-keys` | `src/modules/api-keys/views/api-key.routes.js` | api-keys | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0002 | POST | `/api/v1/api-keys` | `src/modules/api-keys/views/api-key.routes.js` | api-keys | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0003 | POST | `/api/v1/api-keys/:apiKeyId/revoke` | `src/modules/api-keys/views/api-key.routes.js` | api-keys | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0004 | POST | `/api/v1/api-keys/:apiKeyId/rotate` | `src/modules/api-keys/views/api-key.routes.js` | api-keys | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0005 | GET | `/api/v1/audit` | `src/modules/audit/views/audit.routes.js` | audit | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0006 | POST | `/api/v1/auth/login` | `src/modules/identity/views/auth.routes.js` | auth | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0007 | POST | `/api/v1/auth/logout` | `src/modules/identity/views/auth.routes.js` | auth | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0008 | GET | `/api/v1/auth/me` | `src/modules/identity/views/auth.routes.js` | auth | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0009 | POST | `/api/v1/auth/refresh` | `src/modules/identity/views/auth.routes.js` | auth | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0010 | GET | `/api/v1/cancellations` | `src/modules/cancellations/views/cancellation.routes.js` | cancellations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0011 | POST | `/api/v1/cancellations` | `src/modules/cancellations/views/cancellation.routes.js` | cancellations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0012 | GET | `/api/v1/cancellations/:cancellationId` | `src/modules/cancellations/views/cancellation.routes.js` | cancellations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0013 | GET | `/api/v1/channels` | `src/modules/commerce-integrations/views/commerce-integration.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0014 | POST | `/api/v1/channels` | `src/modules/commerce-integrations/views/commerce-integration.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0015 | GET | `/api/v1/channels/:channelId` | `src/modules/commerce-integrations/views/commerce-integration.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0016 | PATCH | `/api/v1/channels/:channelId` | `src/modules/commerce-integrations/views/commerce-integration.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0017 | DELETE | `/api/v1/channels/:channelId/marketplace-connection` | `src/modules/commerce-integrations/views/commerce-integration.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0018 | GET | `/api/v1/channels/:channelId/marketplace-connection` | `src/modules/commerce-integrations/views/commerce-integration.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0019 | PATCH | `/api/v1/channels/:channelId/marketplace-connection` | `src/modules/commerce-integrations/views/commerce-integration.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0020 | POST | `/api/v1/channels/:channelId/marketplace-connection` | `src/modules/commerce-integrations/views/commerce-integration.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0021 | POST | `/api/v1/channels/:channelId/marketplace-connection/test` | `src/modules/commerce-integrations/views/commerce-integration.routes.js` | channels | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0022 | POST | `/api/v1/inbound/marketplace-webhooks/:ingressToken` | `src/modules/webhooks/marketplace/views/marketplace-webhook.routes.js` | marketplace-webhook-ingestion | webhook ingress token (marketplace adapter) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0023 | GET | `/api/v1/inventory` | `src/modules/inventory/views/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0024 | GET | `/api/v1/inventory/:productId` | `src/modules/inventory/views/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0025 | POST | `/api/v1/inventory/adjustments` | `src/modules/inventory/views/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0026 | POST | `/api/v1/inventory/receipts` | `src/modules/inventory/views/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0027 | POST | `/api/v1/inventory/releases` | `src/modules/inventory/views/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0028 | POST | `/api/v1/inventory/reservations` | `src/modules/inventory/views/inventory.routes.js` | inventory | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0029 | GET | `/api/v1/marketplaces` | `src/modules/marketplaces/views/marketplace.routes.js` | marketplaces | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0030 | POST | `/api/v1/marketplaces` | `src/modules/marketplaces/views/marketplace.routes.js` | marketplaces | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0031 | GET | `/api/v1/marketplaces/:id` | `src/modules/marketplaces/views/marketplace.routes.js` | marketplaces | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0032 | PATCH | `/api/v1/marketplaces/:id` | `src/modules/marketplaces/views/marketplace.routes.js` | marketplaces | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0033 | GET | `/api/v1/memberships/:membershipId/roles` | `src/modules/authorization/views/authorization.routes.js` | memberships | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0034 | POST | `/api/v1/memberships/:membershipId/roles` | `src/modules/authorization/views/authorization.routes.js` | memberships | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0035 | DELETE | `/api/v1/memberships/:membershipId/roles/:roleId` | `src/modules/authorization/views/authorization.routes.js` | memberships | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0036 | POST | `/api/v1/mfa/recovery-code/use` | `src/modules/mfa/views/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0037 | POST | `/api/v1/mfa/totp/activate` | `src/modules/mfa/views/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0038 | POST | `/api/v1/mfa/totp/start` | `src/modules/mfa/views/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0039 | POST | `/api/v1/mfa/totp/verify` | `src/modules/mfa/views/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0040 | POST | `/api/v1/mfa/verify` | `src/modules/mfa/views/mfa.routes.js` | mfa | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0041 | GET | `/api/v1/offers` | `src/modules/offers/views/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0042 | POST | `/api/v1/offers` | `src/modules/offers/views/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0043 | GET | `/api/v1/offers/:offerId` | `src/modules/offers/views/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0044 | PATCH | `/api/v1/offers/:offerId` | `src/modules/offers/views/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0045 | POST | `/api/v1/offers/:offerId/activate` | `src/modules/offers/views/offer.routes.js` | offers | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0046 | GET | `/api/v1/orders` | `src/modules/orders/controllers/order.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0047 | POST | `/api/v1/orders` | `src/modules/orders/controllers/order.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0048 | GET | `/api/v1/orders/:orderId` | `src/modules/orders/controllers/order.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0049 | POST | `/api/v1/orders/:orderId/cancel` | `src/modules/cancellations/views/cancellation.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0050 | POST | `/api/v1/orders/:orderId/confirm` | `src/modules/orders/controllers/order.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0051 | POST | `/api/v1/orders/:orderId/returns` | `src/modules/returns/views/return.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0052 | POST | `/api/v1/orders/:orderId/shipments` | `src/modules/shipments/views/shipment.routes.js` | orders | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0053 | GET | `/api/v1/permissions` | `src/modules/authorization/views/authorization.routes.js` | permissions | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0054 | GET | `/api/v1/prices` | `src/modules/pricing/views/price.routes.js` | prices | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0055 | POST | `/api/v1/prices` | `src/modules/pricing/views/price.routes.js` | prices | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0056 | GET | `/api/v1/prices/:priceId` | `src/modules/pricing/views/price.routes.js` | prices | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0057 | PATCH | `/api/v1/prices/:priceId` | `src/modules/pricing/views/price.routes.js` | prices | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0058 | GET | `/api/v1/products` | `src/modules/products/views/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0059 | POST | `/api/v1/products` | `src/modules/products/views/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0060 | GET | `/api/v1/products/:productId` | `src/modules/products/views/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0061 | PATCH | `/api/v1/products/:productId` | `src/modules/products/views/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0062 | POST | `/api/v1/products/:productId/archive` | `src/modules/products/views/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0063 | GET | `/api/v1/products/:productId/content` | `src/modules/products/views/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0064 | PUT | `/api/v1/products/:productId/content/:locale` | `src/modules/products/views/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0065 | POST | `/api/v1/products/:productId/deactivate` | `src/modules/products/views/product.routes.js` | products | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0066 | GET | `/api/v1/returns` | `src/modules/returns/views/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0067 | GET | `/api/v1/returns/:returnId` | `src/modules/returns/views/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0068 | POST | `/api/v1/returns/:returnId/approve` | `src/modules/returns/views/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0069 | POST | `/api/v1/returns/:returnId/cancel` | `src/modules/returns/views/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0070 | POST | `/api/v1/returns/:returnId/complete` | `src/modules/returns/views/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0071 | POST | `/api/v1/returns/:returnId/receive` | `src/modules/returns/views/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0072 | POST | `/api/v1/returns/:returnId/reject` | `src/modules/returns/views/return.routes.js` | returns | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0073 | GET | `/api/v1/roles` | `src/modules/authorization/views/authorization.routes.js` | roles | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0074 | POST | `/api/v1/roles` | `src/modules/authorization/views/authorization.routes.js` | roles | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0075 | GET | `/api/v1/shipments` | `src/modules/shipments/views/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0076 | GET | `/api/v1/shipments/:shipmentId` | `src/modules/shipments/views/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0077 | POST | `/api/v1/shipments/:shipmentId/cancel` | `src/modules/shipments/views/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0078 | POST | `/api/v1/shipments/:shipmentId/deliver` | `src/modules/shipments/views/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0079 | POST | `/api/v1/shipments/:shipmentId/ship` | `src/modules/shipments/views/shipment.routes.js` | shipments | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0080 | GET | `/api/v1/stock-locations` | `src/modules/inventory/views/inventory.routes.js` | stock-locations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0081 | POST | `/api/v1/stock-locations` | `src/modules/inventory/views/inventory.routes.js` | stock-locations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0082 | GET | `/api/v1/stock-locations/:stockLocationId` | `src/modules/inventory/views/inventory.routes.js` | stock-locations | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0083 | POST | `/api/v1/tenants` | `src/modules/tenants/views/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0084 | GET | `/api/v1/tenants/:tenantId` | `src/modules/tenants/views/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0085 | POST | `/api/v1/tenants/:tenantId/close` | `src/modules/tenants/views/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0086 | POST | `/api/v1/tenants/:tenantId/reactivate` | `src/modules/tenants/views/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0087 | POST | `/api/v1/tenants/:tenantId/suspend` | `src/modules/tenants/views/tenant.routes.js` | tenants | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0088 | GET | `/api/v1/webhooks` | `src/modules/webhooks/outbound/views/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0089 | POST | `/api/v1/webhooks` | `src/modules/webhooks/outbound/views/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0090 | DELETE | `/api/v1/webhooks/:webhookId` | `src/modules/webhooks/outbound/views/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0091 | GET | `/api/v1/webhooks/:webhookId` | `src/modules/webhooks/outbound/views/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0092 | PATCH | `/api/v1/webhooks/:webhookId` | `src/modules/webhooks/outbound/views/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0093 | GET | `/api/v1/webhooks/:webhookId/deliveries` | `src/modules/webhooks/outbound/views/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0094 | GET | `/api/v1/webhooks/:webhookId/deliveries/:deliveryId` | `src/modules/webhooks/outbound/views/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0095 | POST | `/api/v1/webhooks/:webhookId/rotate-secret` | `src/modules/webhooks/outbound/views/webhook.routes.js` | webhooks | Bearer or x-api-key header (default) | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0096 | POST | `/api/v2/cancellations` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0097 | GET | `/api/v2/cancellations/merchant` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0098 | POST | `/api/v2/ce/cancellations` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0099 | GET | `/api/v2/ce/channels` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0100 | GET | `/api/v2/ce/channels/:channelId/products` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0101 | PUT | `/api/v2/ce/offer` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0102 | PUT | `/api/v2/ce/offer/stock` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0103 | GET | `/api/v2/ce/orders` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0104 | GET | `/api/v2/ce/orders/:merchantOrderNo/invoice` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0105 | POST | `/api/v2/ce/orders/acknowledge` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0106 | GET | `/api/v2/ce/products` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0107 | POST | `/api/v2/ce/products` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0108 | POST | `/api/v2/ce/products/bulkdelete` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0109 | PATCH | `/api/v2/ce/products/extra-data/bulk` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0110 | POST | `/api/v2/ce/products/freeze` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0111 | GET | `/api/v2/ce/returns` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0112 | PUT | `/api/v2/ce/returns` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0113 | POST | `/api/v2/ce/returns/merchant` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0114 | POST | `/api/v2/ce/returns/merchant/acknowledge` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0115 | POST | `/api/v2/ce/shipments` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0116 | PUT | `/api/v2/ce/shipments/:merchantShipmentNo/delivery-state` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0117 | GET | `/api/v2/ce/shipments/merchant` | `src/modules/compatibility/views/compat-v2.routes.js` | compatibility-stockconnect-ce | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0118 | GET | `/api/v2/foundation/ping` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0119 | PUT | `/api/v2/offer` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0120 | PUT | `/api/v2/offer/stock` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0121 | GET | `/api/v2/orders` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0122 | POST | `/api/v2/orders` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0123 | POST | `/api/v2/orders/acknowledge` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0124 | POST | `/api/v2/orders/channel-fulfilled` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0125 | GET | `/api/v2/orders/new` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0126 | GET | `/api/v2/products` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0127 | POST | `/api/v2/products` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0128 | POST | `/api/v2/products/bulkdelete` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0129 | PATCH | `/api/v2/products/extra-data/bulk` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0130 | POST | `/api/v2/products/freeze` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0131 | POST | `/api/v2/returns` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0132 | PUT | `/api/v2/returns` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0133 | GET | `/api/v2/returns/merchant` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0134 | GET | `/api/v2/returns/merchant/:merchantOrderNo` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0135 | POST | `/api/v2/returns/merchant/acknowledge` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0136 | GET | `/api/v2/returns/merchant/new` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0137 | POST | `/api/v2/shipments` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0138 | PUT | `/api/v2/shipments/:merchantShipmentNo` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0139 | GET | `/api/v2/shipments/merchant` | `src/modules/compatibility/views/compatibility.routes.js` | compatibility-v2 | Bearer or x-api-key header | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0140 | GET | `/health/live` | `src/workers/observability/worker-observability.routes.js` | health-observability | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0141 | GET | `/health/ready` | `src/workers/observability/worker-observability.routes.js` | health-observability | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |
| R-0142 | GET | `/internal/metrics` | `src/workers/observability/worker-observability.routes.js` | metrics | public | CONFIRMED | AUTO (fastify-type-provider-zod + @fastify/swagger when schema present) |

## Reconciliation notes

- Routes are registered in `src/app/http/create-server.js` via `app.register(moduleRoutes, deps)`.
- Compatibility registers **both** `compatibility.routes.js` and `compat-v2.routes.js` (`/api/v2/*` and `/api/v2/ce/*`).
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

