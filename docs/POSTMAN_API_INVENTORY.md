# Postman API inventory

**Source:** verified against `docs/API_ROUTE_INVENTORY.md`, OpenAPI snapshot, and worker route files.

| Metric | Count |
| ------ | ----: |
| Main-server endpoints | 142 |
| Worker-only endpoints | 3 |
| **Total confirmed endpoints** | **145** |

## Main server

| Route ID | HTTP Method | Full API Path | API Module | Route File | Authentication | Registration | Postman Status |
| -------- | ----------- | ------------- | ---------- | ---------- | -------------- | ------------ | -------------- |
| R-0001 | GET | `/api/v1/api-keys` | api-keys | `src/modules/api-keys/presentation/api-key.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0002 | POST | `/api/v1/api-keys` | api-keys | `src/modules/api-keys/presentation/api-key.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0003 | POST | `/api/v1/api-keys/:apiKeyId/revoke` | api-keys | `src/modules/api-keys/presentation/api-key.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0004 | POST | `/api/v1/api-keys/:apiKeyId/rotate` | api-keys | `src/modules/api-keys/presentation/api-key.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0005 | GET | `/api/v1/audit` | audit | `src/modules/audit/presentation/audit.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0006 | POST | `/api/v1/auth/login` | auth | `src/modules/identity/presentation/auth.routes.js` | public | CONFIRMED | generated |
| R-0007 | POST | `/api/v1/auth/logout` | auth | `src/modules/identity/presentation/auth.routes.js` | public | CONFIRMED | generated |
| R-0008 | GET | `/api/v1/auth/me` | auth | `src/modules/identity/presentation/auth.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0009 | POST | `/api/v1/auth/refresh` | auth | `src/modules/identity/presentation/auth.routes.js` | public | CONFIRMED | generated |
| R-0010 | GET | `/api/v1/cancellations` | cancellations | `src/modules/cancellations/presentation/cancellation.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0011 | POST | `/api/v1/cancellations` | cancellations | `src/modules/cancellations/presentation/cancellation.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0012 | GET | `/api/v1/cancellations/:cancellationId` | cancellations | `src/modules/cancellations/presentation/cancellation.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0013 | GET | `/api/v1/channels` | channels | `src/modules/commerce-integrations/presentation/commerce-integration.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0014 | POST | `/api/v1/channels` | channels | `src/modules/commerce-integrations/presentation/commerce-integration.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0015 | GET | `/api/v1/channels/:channelId` | channels | `src/modules/commerce-integrations/presentation/commerce-integration.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0016 | PATCH | `/api/v1/channels/:channelId` | channels | `src/modules/commerce-integrations/presentation/commerce-integration.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0017 | DELETE | `/api/v1/channels/:channelId/marketplace-connection` | channels | `src/modules/commerce-integrations/presentation/commerce-integration.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0018 | GET | `/api/v1/channels/:channelId/marketplace-connection` | channels | `src/modules/commerce-integrations/presentation/commerce-integration.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0019 | PATCH | `/api/v1/channels/:channelId/marketplace-connection` | channels | `src/modules/commerce-integrations/presentation/commerce-integration.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0020 | POST | `/api/v1/channels/:channelId/marketplace-connection` | channels | `src/modules/commerce-integrations/presentation/commerce-integration.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0021 | POST | `/api/v1/channels/:channelId/marketplace-connection/test` | channels | `src/modules/commerce-integrations/presentation/commerce-integration.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0022 | POST | `/api/v1/inbound/marketplace-webhooks/:ingressToken` | marketplace-webhook-ingestion | `src/modules/marketplace-webhook-ingestion/presentation/marketplace-webhook.routes.js` | webhook ingress token (marketplace adapter) | CONFIRMED | generated |
| R-0023 | GET | `/api/v1/inventory` | inventory | `src/modules/inventory/presentation/inventory.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0024 | GET | `/api/v1/inventory/:productId` | inventory | `src/modules/inventory/presentation/inventory.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0025 | POST | `/api/v1/inventory/adjustments` | inventory | `src/modules/inventory/presentation/inventory.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0026 | POST | `/api/v1/inventory/receipts` | inventory | `src/modules/inventory/presentation/inventory.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0027 | POST | `/api/v1/inventory/releases` | inventory | `src/modules/inventory/presentation/inventory.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0028 | POST | `/api/v1/inventory/reservations` | inventory | `src/modules/inventory/presentation/inventory.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0029 | GET | `/api/v1/marketplaces` | marketplaces | `src/modules/marketplaces/presentation/marketplace.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0030 | POST | `/api/v1/marketplaces` | marketplaces | `src/modules/marketplaces/presentation/marketplace.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0031 | GET | `/api/v1/marketplaces/:id` | marketplaces | `src/modules/marketplaces/presentation/marketplace.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0032 | PATCH | `/api/v1/marketplaces/:id` | marketplaces | `src/modules/marketplaces/presentation/marketplace.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0033 | GET | `/api/v1/memberships/:membershipId/roles` | memberships | `src/modules/authorization/presentation/authorization.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0034 | POST | `/api/v1/memberships/:membershipId/roles` | memberships | `src/modules/authorization/presentation/authorization.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0035 | DELETE | `/api/v1/memberships/:membershipId/roles/:roleId` | memberships | `src/modules/authorization/presentation/authorization.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0036 | POST | `/api/v1/mfa/recovery-code/use` | mfa | `src/modules/mfa/presentation/mfa.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0037 | POST | `/api/v1/mfa/totp/activate` | mfa | `src/modules/mfa/presentation/mfa.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0038 | POST | `/api/v1/mfa/totp/start` | mfa | `src/modules/mfa/presentation/mfa.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0039 | POST | `/api/v1/mfa/totp/verify` | mfa | `src/modules/mfa/presentation/mfa.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0040 | POST | `/api/v1/mfa/verify` | mfa | `src/modules/mfa/presentation/mfa.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0041 | GET | `/api/v1/offers` | offers | `src/modules/offers/presentation/offer.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0042 | POST | `/api/v1/offers` | offers | `src/modules/offers/presentation/offer.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0043 | GET | `/api/v1/offers/:offerId` | offers | `src/modules/offers/presentation/offer.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0044 | PATCH | `/api/v1/offers/:offerId` | offers | `src/modules/offers/presentation/offer.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0045 | POST | `/api/v1/offers/:offerId/activate` | offers | `src/modules/offers/presentation/offer.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0046 | GET | `/api/v1/orders` | orders | `src/modules/orders/presentation/order.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0047 | POST | `/api/v1/orders` | orders | `src/modules/orders/presentation/order.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0048 | GET | `/api/v1/orders/:orderId` | orders | `src/modules/orders/presentation/order.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0049 | POST | `/api/v1/orders/:orderId/cancel` | orders | `src/modules/cancellations/presentation/cancellation.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0050 | POST | `/api/v1/orders/:orderId/confirm` | orders | `src/modules/orders/presentation/order.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0051 | POST | `/api/v1/orders/:orderId/returns` | orders | `src/modules/returns/presentation/return.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0052 | POST | `/api/v1/orders/:orderId/shipments` | orders | `src/modules/shipments/presentation/shipment.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0053 | GET | `/api/v1/permissions` | permissions | `src/modules/authorization/presentation/authorization.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0054 | GET | `/api/v1/prices` | prices | `src/modules/pricing/presentation/price.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0055 | POST | `/api/v1/prices` | prices | `src/modules/pricing/presentation/price.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0056 | GET | `/api/v1/prices/:priceId` | prices | `src/modules/pricing/presentation/price.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0057 | PATCH | `/api/v1/prices/:priceId` | prices | `src/modules/pricing/presentation/price.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0058 | GET | `/api/v1/products` | products | `src/modules/products/presentation/product.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0059 | POST | `/api/v1/products` | products | `src/modules/products/presentation/product.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0060 | GET | `/api/v1/products/:productId` | products | `src/modules/products/presentation/product.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0061 | PATCH | `/api/v1/products/:productId` | products | `src/modules/products/presentation/product.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0062 | POST | `/api/v1/products/:productId/archive` | products | `src/modules/products/presentation/product.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0063 | GET | `/api/v1/products/:productId/content` | products | `src/modules/products/presentation/product.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0064 | PUT | `/api/v1/products/:productId/content/:locale` | products | `src/modules/products/presentation/product.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0065 | POST | `/api/v1/products/:productId/deactivate` | products | `src/modules/products/presentation/product.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0066 | GET | `/api/v1/returns` | returns | `src/modules/returns/presentation/return.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0067 | GET | `/api/v1/returns/:returnId` | returns | `src/modules/returns/presentation/return.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0068 | POST | `/api/v1/returns/:returnId/approve` | returns | `src/modules/returns/presentation/return.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0069 | POST | `/api/v1/returns/:returnId/cancel` | returns | `src/modules/returns/presentation/return.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0070 | POST | `/api/v1/returns/:returnId/complete` | returns | `src/modules/returns/presentation/return.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0071 | POST | `/api/v1/returns/:returnId/receive` | returns | `src/modules/returns/presentation/return.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0072 | POST | `/api/v1/returns/:returnId/reject` | returns | `src/modules/returns/presentation/return.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0073 | GET | `/api/v1/roles` | roles | `src/modules/authorization/presentation/authorization.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0074 | POST | `/api/v1/roles` | roles | `src/modules/authorization/presentation/authorization.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0075 | GET | `/api/v1/shipments` | shipments | `src/modules/shipments/presentation/shipment.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0076 | GET | `/api/v1/shipments/:shipmentId` | shipments | `src/modules/shipments/presentation/shipment.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0077 | POST | `/api/v1/shipments/:shipmentId/cancel` | shipments | `src/modules/shipments/presentation/shipment.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0078 | POST | `/api/v1/shipments/:shipmentId/deliver` | shipments | `src/modules/shipments/presentation/shipment.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0079 | POST | `/api/v1/shipments/:shipmentId/ship` | shipments | `src/modules/shipments/presentation/shipment.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0080 | GET | `/api/v1/stock-locations` | stock-locations | `src/modules/inventory/presentation/inventory.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0081 | POST | `/api/v1/stock-locations` | stock-locations | `src/modules/inventory/presentation/inventory.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0082 | GET | `/api/v1/stock-locations/:stockLocationId` | stock-locations | `src/modules/inventory/presentation/inventory.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0083 | POST | `/api/v1/tenants` | tenants | `src/modules/tenants/presentation/tenant.routes.js` | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | generated |
| R-0084 | GET | `/api/v1/tenants/:tenantId` | tenants | `src/modules/tenants/presentation/tenant.routes.js` | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | generated |
| R-0085 | POST | `/api/v1/tenants/:tenantId/close` | tenants | `src/modules/tenants/presentation/tenant.routes.js` | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | generated |
| R-0086 | POST | `/api/v1/tenants/:tenantId/reactivate` | tenants | `src/modules/tenants/presentation/tenant.routes.js` | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | generated |
| R-0087 | POST | `/api/v1/tenants/:tenantId/suspend` | tenants | `src/modules/tenants/presentation/tenant.routes.js` | mixed (POST create public; GET by id public per auth plugin) | CONFIRMED | generated |
| R-0088 | GET | `/api/v1/webhooks` | webhooks | `src/modules/webhooks/presentation/webhook.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0089 | POST | `/api/v1/webhooks` | webhooks | `src/modules/webhooks/presentation/webhook.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0090 | DELETE | `/api/v1/webhooks/:webhookId` | webhooks | `src/modules/webhooks/presentation/webhook.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0091 | GET | `/api/v1/webhooks/:webhookId` | webhooks | `src/modules/webhooks/presentation/webhook.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0092 | PATCH | `/api/v1/webhooks/:webhookId` | webhooks | `src/modules/webhooks/presentation/webhook.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0093 | GET | `/api/v1/webhooks/:webhookId/deliveries` | webhooks | `src/modules/webhooks/presentation/webhook.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0094 | GET | `/api/v1/webhooks/:webhookId/deliveries/:deliveryId` | webhooks | `src/modules/webhooks/presentation/webhook.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0095 | POST | `/api/v1/webhooks/:webhookId/rotate-secret` | webhooks | `src/modules/webhooks/presentation/webhook.routes.js` | Bearer or x-api-key header (default) | CONFIRMED | generated |
| R-0096 | POST | `/api/v2/cancellations` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0097 | GET | `/api/v2/cancellations/merchant` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0098 | POST | `/api/v2/ce/cancellations` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0099 | GET | `/api/v2/ce/channels` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0100 | GET | `/api/v2/ce/channels/:channelId/products` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0101 | PUT | `/api/v2/ce/offer` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0102 | PUT | `/api/v2/ce/offer/stock` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0103 | GET | `/api/v2/ce/orders` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0104 | GET | `/api/v2/ce/orders/:merchantOrderNo/invoice` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0105 | POST | `/api/v2/ce/orders/acknowledge` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0106 | GET | `/api/v2/ce/products` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0107 | POST | `/api/v2/ce/products` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0108 | POST | `/api/v2/ce/products/bulkdelete` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0109 | PATCH | `/api/v2/ce/products/extra-data/bulk` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0110 | POST | `/api/v2/ce/products/freeze` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0111 | GET | `/api/v2/ce/returns` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0112 | PUT | `/api/v2/ce/returns` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0113 | POST | `/api/v2/ce/returns/merchant` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0114 | POST | `/api/v2/ce/returns/merchant/acknowledge` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0115 | POST | `/api/v2/ce/shipments` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0116 | PUT | `/api/v2/ce/shipments/:merchantShipmentNo/delivery-state` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0117 | GET | `/api/v2/ce/shipments/merchant` | compatibility-stockconnect-ce | `src/modules/compatibility/presentation/compat-v2.routes.js` | api-key (query apiKey/apikey or X-CE-KEY) or Bearer | CONFIRMED | generated |
| R-0118 | GET | `/api/v2/foundation/ping` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or api-key header | CONFIRMED | generated |
| R-0119 | PUT | `/api/v2/offer` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0120 | PUT | `/api/v2/offer/stock` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0121 | GET | `/api/v2/orders` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0122 | POST | `/api/v2/orders` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0123 | POST | `/api/v2/orders/acknowledge` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0124 | POST | `/api/v2/orders/channel-fulfilled` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0125 | GET | `/api/v2/orders/new` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0126 | GET | `/api/v2/products` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0127 | POST | `/api/v2/products` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0128 | POST | `/api/v2/products/bulkdelete` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0129 | PATCH | `/api/v2/products/extra-data/bulk` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0130 | POST | `/api/v2/products/freeze` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0131 | POST | `/api/v2/returns` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0132 | PUT | `/api/v2/returns` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0133 | GET | `/api/v2/returns/merchant` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0134 | GET | `/api/v2/returns/merchant/:merchantOrderNo` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0135 | POST | `/api/v2/returns/merchant/acknowledge` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0136 | GET | `/api/v2/returns/merchant/new` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0137 | POST | `/api/v2/shipments` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0138 | PUT | `/api/v2/shipments/:merchantShipmentNo` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0139 | GET | `/api/v2/shipments/merchant` | compatibility-v2 | `src/modules/compatibility/presentation/compatibility.routes.js` | Bearer or x-api-key header | CONFIRMED | generated |
| R-0140 | GET | `/health/live` | health-observability | `src/workers/observability/worker-observability.routes.js` | public | CONFIRMED | generated |
| R-0141 | GET | `/health/ready` | health-observability | `src/workers/observability/worker-observability.routes.js` | public | CONFIRMED | generated |
| R-0142 | GET | `/internal/metrics` | metrics | `src/workers/observability/worker-observability.routes.js` | public | CONFIRMED | generated |

### Field notes

| Field | Verification |
| ----- | -------------- |
| Handler | Fastify handler in route file; OpenAPI `summary` from Zod route schema |
| Request body / query | OpenAPI snapshot from Zod `schema` on route |
| Authorization | RBAC enforced in handlers; not fully expressed in OpenAPI — use tenant membership with required permissions |
| Content-Type | `application/json` unless multipart (none in main inventory) |

## Worker observability

| Route ID | HTTP Method | Full API Path | Route File | Registration | Postman Status |
| -------- | ----------- | ------------- | ---------- | ------------ | -------------- |
| W-0001 | GET | `/health/live` | `src/workers/observability/worker-observability.routes.js` | CONFIRMED (conditional on `WORKER_OBSERVABILITY_HTTP_ENABLED`) | generated |
| W-0002 | GET | `/health/ready` | `src/workers/observability/worker-observability.routes.js` | CONFIRMED (conditional on `WORKER_OBSERVABILITY_HTTP_ENABLED`) | generated |
| W-0003 | GET | `/internal/metrics` | `src/workers/observability/worker-observability.routes.js` | CONFIRMED (conditional on `WORKER_OBSERVABILITY_HTTP_ENABLED`) | generated |

## Reconciliation

- Main-server count **147** matches static inventory (re-run `node scripts/audit-route-inventory.mjs` after route changes).
- OpenAPI snapshot: `node scripts/dump-openapi.mjs docs/.openapi-snapshot.json`
- Postman coverage: `node scripts/verify-postman-coverage.mjs`

