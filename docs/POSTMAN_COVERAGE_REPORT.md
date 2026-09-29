# Postman coverage report

**Collection:** `postman/Nexora_Backend_API.postman_collection.json`

## Summary

| Metric | Count |
| ------ | ----: |
| Confirmed main-server endpoints | 147 |
| Worker-only endpoints | 3 |
| Total inventory endpoints | 150 |
| Postman requests (leaf) | 150 |
| Matched by Route ID | 150 |
| Missing | 0 |
| Duplicate method+path requests | 0 |
| Requests with auth block | 150 |
| Requests with body | 68 |
| Requests with response examples | 141 |
| Collection JSON valid v2.1 | yes |

## Route-to-Postman mapping

| Route ID | HTTP Method | Full API Path | Postman Folder | Request Name | Collection Status | Verification |
| -------- | ----------- | ------------- | -------------- | ------------ | ----------------- | ------------ |
| R-0001 | GET | `/api-docs` | Health & Documentation | [R-0001] GET /api-docs | GENERATED | MATCH |
| R-0002 | GET | `/api-docs.json` | Health & Documentation | [R-0002] GET /api-docs.json | GENERATED | MATCH |
| R-0003 | GET | `/api/v1/api-keys` | API Keys | [R-0003] List API keys for the current tenant | GENERATED | MATCH |
| R-0004 | POST | `/api/v1/api-keys` | API Keys | [R-0004] Create an API key (secret shown once) | GENERATED | MATCH |
| R-0005 | POST | `/api/v1/api-keys/:apiKeyId/revoke` | API Keys | [R-0005] Revoke an API key | GENERATED | MATCH |
| R-0006 | POST | `/api/v1/api-keys/:apiKeyId/rotate` | API Keys | [R-0006] Rotate an API key (requires step-up; secret shown once) | GENERATED | MATCH |
| R-0007 | GET | `/api/v1/audit` | Audit | [R-0007] List security audit events for the current tenant | GENERATED | MATCH |
| R-0008 | POST | `/api/v1/auth/login` | Auth | [R-0008] Authenticate with tenant slug, email and password | GENERATED | MATCH |
| R-0009 | POST | `/api/v1/auth/logout` | Auth | [R-0009] Revoke the current refresh session | GENERATED | MATCH |
| R-0010 | GET | `/api/v1/auth/me` | Auth | [R-0010] Return the authenticated user for the current access token | GENERATED | MATCH |
| R-0011 | POST | `/api/v1/auth/refresh` | Auth | [R-0011] Rotate refresh token and issue a new access token | GENERATED | MATCH |
| R-0012 | GET | `/api/v1/cancellations` | Cancellations | [R-0012] List cancellations | GENERATED | MATCH |
| R-0013 | POST | `/api/v1/cancellations` | Cancellations | [R-0013] Create a cancellation for an order | GENERATED | MATCH |
| R-0014 | GET | `/api/v1/cancellations/:cancellationId` | Cancellations | [R-0014] Get a cancellation by id | GENERATED | MATCH |
| R-0015 | GET | `/api/v1/channels` | Channels | [R-0015] List tenant channels | GENERATED | MATCH |
| R-0016 | POST | `/api/v1/channels` | Channels | [R-0016] Create a tenant channel | GENERATED | MATCH |
| R-0017 | GET | `/api/v1/channels/:channelId` | Channels | [R-0017] Get a channel by id | GENERATED | MATCH |
| R-0018 | PATCH | `/api/v1/channels/:channelId` | Channels | [R-0018] Update a channel | GENERATED | MATCH |
| R-0019 | DELETE | `/api/v1/channels/:channelId/marketplace-connection` | Channels | [R-0019] Disable the marketplace connection for a channel | GENERATED | MATCH |
| R-0020 | GET | `/api/v1/channels/:channelId/marketplace-connection` | Channels | [R-0020] Get the active marketplace connection for a channel | GENERATED | MATCH |
| R-0021 | PATCH | `/api/v1/channels/:channelId/marketplace-connection` | Channels | [R-0021] Update marketplace connection configuration or credentials | GENERATED | MATCH |
| R-0022 | POST | `/api/v1/channels/:channelId/marketplace-connection` | Channels | [R-0022] Create or replace the marketplace connection for a channel | GENERATED | MATCH |
| R-0023 | POST | `/api/v1/channels/:channelId/marketplace-connection/test` | Channels | [R-0023] Verify marketplace connection credentials and connectivity | GENERATED | MATCH |
| R-0024 | POST | `/api/v1/foundation/echo` | Foundation | [R-0024] Echoes a validated payload | GENERATED | MATCH |
| R-0025 | GET | `/api/v1/foundation/ping` | Foundation | [R-0025] Foundation liveness probe for the native API | GENERATED | MATCH |
| R-0026 | POST | `/api/v1/inbound/marketplace-webhooks/:ingressToken` | Marketplace Webhooks | [R-0026] Receive inbound marketplace webhook (provider-neutral ingress) | GENERATED | MATCH |
| R-0027 | GET | `/api/v1/inventory` | Inventory | [R-0027] List inventory balances for the current tenant | GENERATED | MATCH |
| R-0028 | GET | `/api/v1/inventory/:productId` | Inventory | [R-0028] Get inventory balances for a product | GENERATED | MATCH |
| R-0029 | POST | `/api/v1/inventory/adjustments` | Inventory | [R-0029] Adjust inventory quantities | GENERATED | MATCH |
| R-0030 | POST | `/api/v1/inventory/receipts` | Inventory | [R-0030] Receive inventory into a stock location | GENERATED | MATCH |
| R-0031 | POST | `/api/v1/inventory/releases` | Inventory | [R-0031] Release a prior inventory reservation | GENERATED | MATCH |
| R-0032 | POST | `/api/v1/inventory/reservations` | Inventory | [R-0032] Reserve inventory for a business reference | GENERATED | MATCH |
| R-0033 | GET | `/api/v1/marketplaces` | Marketplaces | [R-0033] List global marketplace definitions | GENERATED | MATCH |
| R-0034 | POST | `/api/v1/marketplaces` | Marketplaces | [R-0034] Create a global marketplace definition | GENERATED | MATCH |
| R-0035 | GET | `/api/v1/marketplaces/:id` | Marketplaces | [R-0035] Get a marketplace by id | GENERATED | MATCH |
| R-0036 | PATCH | `/api/v1/marketplaces/:id` | Marketplaces | [R-0036] Update a marketplace | GENERATED | MATCH |
| R-0037 | GET | `/api/v1/memberships/:membershipId/roles` | Authorization | [R-0037] Get effective permissions for a membership | GENERATED | MATCH |
| R-0038 | POST | `/api/v1/memberships/:membershipId/roles` | Authorization | [R-0038] Assign a role to a membership | GENERATED | MATCH |
| R-0039 | DELETE | `/api/v1/memberships/:membershipId/roles/:roleId` | Authorization | [R-0039] Remove a role from a membership | GENERATED | MATCH |
| R-0040 | POST | `/api/v1/mfa/recovery-code/use` | MFA | [R-0040] Use a one-time recovery code for step-up | GENERATED | MATCH |
| R-0041 | POST | `/api/v1/mfa/totp/activate` | MFA | [R-0041] Activate TOTP factor and receive recovery codes | GENERATED | MATCH |
| R-0042 | POST | `/api/v1/mfa/totp/start` | MFA | [R-0042] Start TOTP enrollment | GENERATED | MATCH |
| R-0043 | POST | `/api/v1/mfa/totp/verify` | MFA | [R-0043] Verify TOTP code during enrollment | GENERATED | MATCH |
| R-0044 | POST | `/api/v1/mfa/verify` | MFA | [R-0044] Verify MFA for step-up authentication | GENERATED | MATCH |
| R-0045 | GET | `/api/v1/offers` | Offers | [R-0045] List channel offers | GENERATED | MATCH |
| R-0046 | POST | `/api/v1/offers` | Offers | [R-0046] Create a channel offer | GENERATED | MATCH |
| R-0047 | GET | `/api/v1/offers/:offerId` | Offers | [R-0047] Get an offer by id | GENERATED | MATCH |
| R-0048 | PATCH | `/api/v1/offers/:offerId` | Offers | [R-0048] Update an offer or change lifecycle status | GENERATED | MATCH |
| R-0049 | POST | `/api/v1/offers/:offerId/activate` | Offers | [R-0049] Activate a draft or suspended offer | GENERATED | MATCH |
| R-0050 | GET | `/api/v1/orders` | Orders | [R-0050] List orders | GENERATED | MATCH |
| R-0051 | POST | `/api/v1/orders` | Orders | [R-0051] Create an order | GENERATED | MATCH |
| R-0052 | GET | `/api/v1/orders/:orderId` | Orders | [R-0052] Get an order by id | GENERATED | MATCH |
| R-0053 | POST | `/api/v1/orders/:orderId/cancel` | Orders | [R-0053] Cancel all or part of an order | GENERATED | MATCH |
| R-0054 | POST | `/api/v1/orders/:orderId/confirm` | Orders | [R-0054] Confirm an order | GENERATED | MATCH |
| R-0055 | POST | `/api/v1/orders/:orderId/returns` | Returns | [R-0055] Create a return request for an order | GENERATED | MATCH |
| R-0056 | POST | `/api/v1/orders/:orderId/shipments` | Shipments | [R-0056] Create a shipment for an order | GENERATED | MATCH |
| R-0057 | GET | `/api/v1/permissions` | Authorization | [R-0057] List the global permission catalog | GENERATED | MATCH |
| R-0058 | GET | `/api/v1/prices` | Pricing | [R-0058] List product prices | GENERATED | MATCH |
| R-0059 | POST | `/api/v1/prices` | Pricing | [R-0059] Create a product price | GENERATED | MATCH |
| R-0060 | GET | `/api/v1/prices/:priceId` | Pricing | [R-0060] Get a price by id | GENERATED | MATCH |
| R-0061 | PATCH | `/api/v1/prices/:priceId` | Pricing | [R-0061] Update or deactivate a price | GENERATED | MATCH |
| R-0062 | GET | `/api/v1/products` | Products | [R-0062] List products for the current tenant | GENERATED | MATCH |
| R-0063 | POST | `/api/v1/products` | Products | [R-0063] Create a product | GENERATED | MATCH |
| R-0064 | GET | `/api/v1/products/:productId` | Products | [R-0064] Get a product by id | GENERATED | MATCH |
| R-0065 | PATCH | `/api/v1/products/:productId` | Products | [R-0065] Update a product | GENERATED | MATCH |
| R-0066 | POST | `/api/v1/products/:productId/archive` | Products | [R-0066] Archive a product | GENERATED | MATCH |
| R-0067 | GET | `/api/v1/products/:productId/content` | Products | [R-0067] List localized content for a product | GENERATED | MATCH |
| R-0068 | PUT | `/api/v1/products/:productId/content/:locale` | Products | [R-0068] Upsert localized content for a product | GENERATED | MATCH |
| R-0069 | POST | `/api/v1/products/:productId/deactivate` | Products | [R-0069] Deactivate a product | GENERATED | MATCH |
| R-0070 | GET | `/api/v1/returns` | Returns | [R-0070] List returns | GENERATED | MATCH |
| R-0071 | GET | `/api/v1/returns/:returnId` | Returns | [R-0071] Get a return by id | GENERATED | MATCH |
| R-0072 | POST | `/api/v1/returns/:returnId/approve` | Returns | [R-0072] Approve a return request | GENERATED | MATCH |
| R-0073 | POST | `/api/v1/returns/:returnId/cancel` | Returns | [R-0073] Cancel a return request | GENERATED | MATCH |
| R-0074 | POST | `/api/v1/returns/:returnId/complete` | Returns | [R-0074] Complete a received return | GENERATED | MATCH |
| R-0075 | POST | `/api/v1/returns/:returnId/receive` | Returns | [R-0075] Receive returned goods and restore inventory | GENERATED | MATCH |
| R-0076 | POST | `/api/v1/returns/:returnId/reject` | Returns | [R-0076] Reject a return request | GENERATED | MATCH |
| R-0077 | GET | `/api/v1/roles` | Authorization | [R-0077] List tenant roles | GENERATED | MATCH |
| R-0078 | POST | `/api/v1/roles` | Authorization | [R-0078] Create a custom tenant role | GENERATED | MATCH |
| R-0079 | GET | `/api/v1/shipments` | Shipments | [R-0079] List shipments | GENERATED | MATCH |
| R-0080 | GET | `/api/v1/shipments/:shipmentId` | Shipments | [R-0080] Get a shipment by id | GENERATED | MATCH |
| R-0081 | POST | `/api/v1/shipments/:shipmentId/cancel` | Shipments | [R-0081] Cancel a shipment | GENERATED | MATCH |
| R-0082 | POST | `/api/v1/shipments/:shipmentId/deliver` | Shipments | [R-0082] Mark a shipment as delivered | GENERATED | MATCH |
| R-0083 | POST | `/api/v1/shipments/:shipmentId/ship` | Shipments | [R-0083] Mark a shipment as shipped | GENERATED | MATCH |
| R-0084 | GET | `/api/v1/stock-locations` | Inventory | [R-0084] List stock locations for the current tenant | GENERATED | MATCH |
| R-0085 | POST | `/api/v1/stock-locations` | Inventory | [R-0085] Create a stock location | GENERATED | MATCH |
| R-0086 | GET | `/api/v1/stock-locations/:stockLocationId` | Inventory | [R-0086] Get a stock location by id | GENERATED | MATCH |
| R-0087 | POST | `/api/v1/tenants` | Tenants | [R-0087] Create a tenant | GENERATED | MATCH |
| R-0088 | GET | `/api/v1/tenants/:tenantId` | Tenants | [R-0088] Get a tenant by id | GENERATED | MATCH |
| R-0089 | POST | `/api/v1/tenants/:tenantId/close` | Tenants | [R-0089] Close a tenant (terminal) | GENERATED | MATCH |
| R-0090 | POST | `/api/v1/tenants/:tenantId/reactivate` | Tenants | [R-0090] Reactivate a suspended tenant | GENERATED | MATCH |
| R-0091 | POST | `/api/v1/tenants/:tenantId/suspend` | Tenants | [R-0091] Suspend an active tenant | GENERATED | MATCH |
| R-0092 | GET | `/api/v1/webhooks` | Webhooks | [R-0092] List webhook subscriptions for the current tenant | GENERATED | MATCH |
| R-0093 | POST | `/api/v1/webhooks` | Webhooks | [R-0093] Create a webhook subscription (secret shown once) | GENERATED | MATCH |
| R-0094 | DELETE | `/api/v1/webhooks/:webhookId` | Webhooks | [R-0094] Delete a webhook subscription (soft delete) | GENERATED | MATCH |
| R-0095 | GET | `/api/v1/webhooks/:webhookId` | Webhooks | [R-0095] Get a webhook subscription by id | GENERATED | MATCH |
| R-0096 | PATCH | `/api/v1/webhooks/:webhookId` | Webhooks | [R-0096] Update a webhook subscription | GENERATED | MATCH |
| R-0097 | GET | `/api/v1/webhooks/:webhookId/deliveries` | Webhooks | [R-0097] List delivery history for a webhook subscription | GENERATED | MATCH |
| R-0098 | GET | `/api/v1/webhooks/:webhookId/deliveries/:deliveryId` | Webhooks | [R-0098] Get a single webhook delivery | GENERATED | MATCH |
| R-0099 | POST | `/api/v1/webhooks/:webhookId/rotate-secret` | Webhooks | [R-0099] Rotate a webhook signing secret (requires step-up; secret shown once) | GENERATED | MATCH |
| R-0100 | POST | `/api/v2/cancellations` | Compatibility (v2) | [R-0100] Create a merchant cancellation | GENERATED | MATCH |
| R-0101 | GET | `/api/v2/cancellations/merchant` | Compatibility (v2) | [R-0101] List merchant cancellations | GENERATED | MATCH |
| R-0102 | POST | `/api/v2/ce/cancellations` | StockConnect CE compatibility | [R-0102] Create a merchant cancellation | GENERATED | MATCH |
| R-0103 | GET | `/api/v2/ce/channels` | StockConnect CE compatibility | [R-0103] List channels (StockConnect CE registry sync) | GENERATED | MATCH |
| R-0104 | GET | `/api/v2/ce/channels/:channelId/products` | StockConnect CE compatibility | [R-0104] List channel listing status by SKU (StockConnect productSyncService) | GENERATED | MATCH |
| R-0105 | PUT | `/api/v2/ce/offer` | StockConnect CE compatibility | [R-0105] Update offer price (StockConnect CE OFFER_PRICE) | GENERATED | MATCH |
| R-0106 | PUT | `/api/v2/ce/offer/stock` | StockConnect CE compatibility | [R-0106] Update offer stock (StockConnect CE OFFER_STOCK) | GENERATED | MATCH |
| R-0107 | GET | `/api/v2/ce/orders` | StockConnect CE compatibility | [R-0107] List orders (StockConnect CE poll) | GENERATED | MATCH |
| R-0108 | GET | `/api/v2/ce/orders/:merchantOrderNo/invoice` | StockConnect CE compatibility | [R-0108] Download order invoice PDF (StockConnect CE) | GENERATED | MATCH |
| R-0109 | POST | `/api/v2/ce/orders/acknowledge` | StockConnect CE compatibility | [R-0109] Acknowledge an order (StockConnect CE) | GENERATED | MATCH |
| R-0110 | GET | `/api/v2/ce/products` | StockConnect CE compatibility | [R-0110] List products by merchant SKU (StockConnect CE GET products) | GENERATED | MATCH |
| R-0111 | POST | `/api/v2/ce/products` | StockConnect CE compatibility | [R-0111] Push products (StockConnect CE PRODUCTS_PUSH) | GENERATED | MATCH |
| R-0112 | POST | `/api/v2/ce/products/bulkdelete` | StockConnect CE compatibility | [R-0112] Bulk delete products (StockConnect CE PRODUCTS_BULK_DELETE) | GENERATED | MATCH |
| R-0113 | PATCH | `/api/v2/ce/products/extra-data/bulk` | StockConnect CE compatibility | [R-0113] Patch product extra-data (StockConnect CE PRODUCTS_EXTRA_DATA) | GENERATED | MATCH |
| R-0114 | POST | `/api/v2/ce/products/freeze` | StockConnect CE compatibility | [R-0114] Freeze or unfreeze products (StockConnect CE PRODUCTS_FREEZE) | GENERATED | MATCH |
| R-0115 | GET | `/api/v2/ce/returns` | StockConnect CE compatibility | [R-0115] List returns (StockConnect poll) | GENERATED | MATCH |
| R-0116 | PUT | `/api/v2/ce/returns` | StockConnect CE compatibility | [R-0116] Accept or reject a return | GENERATED | MATCH |
| R-0117 | POST | `/api/v2/ce/returns/merchant` | StockConnect CE compatibility | [R-0117] Create a merchant return | GENERATED | MATCH |
| R-0118 | POST | `/api/v2/ce/returns/merchant/acknowledge` | StockConnect CE compatibility | [R-0118] Acknowledge a merchant return | GENERATED | MATCH |
| R-0119 | POST | `/api/v2/ce/shipments` | StockConnect CE compatibility | [R-0119] Create a merchant shipment | GENERATED | MATCH |
| R-0120 | PUT | `/api/v2/ce/shipments/:merchantShipmentNo/delivery-state` | StockConnect CE compatibility | [R-0120] Update shipment delivery state (StockConnect CE SHIPMENT_DELIVERY_STATE) | GENERATED | MATCH |
| R-0121 | GET | `/api/v2/ce/shipments/merchant` | StockConnect CE compatibility | [R-0121] List merchant shipments | GENERATED | MATCH |
| R-0122 | GET | `/api/v2/foundation/ping` | Compatibility (v2) | [R-0122] Compatibility API liveness probe | GENERATED | MATCH |
| R-0123 | PUT | `/api/v2/offer` | Compatibility (v2) — Catalog | [R-0123] Update offer price | GENERATED | MATCH |
| R-0124 | PUT | `/api/v2/offer/stock` | Compatibility (v2) — Catalog | [R-0124] Update offer stock | GENERATED | MATCH |
| R-0125 | GET | `/api/v2/orders` | Compatibility (v2) | [R-0125] List orders by filter | GENERATED | MATCH |
| R-0126 | POST | `/api/v2/orders` | Compatibility (v2) — Channel | [R-0126] Create a channel order | GENERATED | MATCH |
| R-0127 | POST | `/api/v2/orders/acknowledge` | Compatibility (v2) | [R-0127] Acknowledge an order | GENERATED | MATCH |
| R-0128 | POST | `/api/v2/orders/channel-fulfilled` | Compatibility (v2) — Channel | [R-0128] Create a channel-fulfilled order | GENERATED | MATCH |
| R-0129 | GET | `/api/v2/orders/new` | Compatibility (v2) | [R-0129] List new orders | GENERATED | MATCH |
| R-0130 | GET | `/api/v2/products` | Compatibility (v2) — Catalog | [R-0130] List products by merchant product number | GENERATED | MATCH |
| R-0131 | POST | `/api/v2/products` | Compatibility (v2) — Catalog | [R-0131] Create or update products (CE batch) | GENERATED | MATCH |
| R-0132 | POST | `/api/v2/products/bulkdelete` | Compatibility (v2) — Catalog | [R-0132] Bulk deactivate products | GENERATED | MATCH |
| R-0133 | PATCH | `/api/v2/products/extra-data/bulk` | Compatibility (v2) — Catalog | [R-0133] Bulk update CE ExtraData on products | GENERATED | MATCH |
| R-0134 | POST | `/api/v2/products/freeze` | Compatibility (v2) — Catalog | [R-0134] Freeze products (deactivate or suspend channel offer) | GENERATED | MATCH |
| R-0135 | POST | `/api/v2/returns` | Compatibility (v2) | [R-0135] Create a merchant return | GENERATED | MATCH |
| R-0136 | PUT | `/api/v2/returns` | Compatibility (v2) | [R-0136] Receive a merchant return | GENERATED | MATCH |
| R-0137 | GET | `/api/v2/returns/merchant` | Compatibility (v2) | [R-0137] List merchant returns | GENERATED | MATCH |
| R-0138 | GET | `/api/v2/returns/merchant/:merchantOrderNo` | Compatibility (v2) | [R-0138] List returns for a merchant order | GENERATED | MATCH |
| R-0139 | POST | `/api/v2/returns/merchant/acknowledge` | Compatibility (v2) | [R-0139] Acknowledge a merchant return | GENERATED | MATCH |
| R-0140 | GET | `/api/v2/returns/merchant/new` | Compatibility (v2) | [R-0140] List unhandled merchant returns | GENERATED | MATCH |
| R-0141 | POST | `/api/v2/shipments` | Compatibility (v2) | [R-0141] Create a merchant shipment | GENERATED | MATCH |
| R-0142 | PUT | `/api/v2/shipments/:merchantShipmentNo` | Compatibility (v2) | [R-0142] Update merchant shipment tracking | GENERATED | MATCH |
| R-0143 | GET | `/api/v2/shipments/merchant` | Compatibility (v2) | [R-0143] List merchant shipments | GENERATED | MATCH |
| R-0144 | GET | `/health/live` | Health & Documentation | [R-0144] GET /health/live | GENERATED | MATCH |
| R-0145 | GET | `/health/ready` | Health & Documentation | [R-0145] GET /health/ready | GENERATED | MATCH |
| R-0146 | GET | `/internal/metrics` | Health & Monitoring | [R-0146] GET /internal/metrics | GENERATED | MATCH |
| R-0147 | GET | `/openapi.json` | Health & Documentation | [R-0147] GET /openapi.json | GENERATED | MATCH |
| W-0001 | GET | `/health/live` | Worker Observability (separate listener) | [W-0001] GET /health/live | GENERATED | MATCH |
| W-0002 | GET | `/health/ready` | Worker Observability (separate listener) | [W-0002] GET /health/ready | GENERATED | MATCH |
| W-0003 | GET | `/internal/metrics` | Worker Observability (separate listener) | [W-0003] GET /internal/metrics | GENERATED | MATCH |

