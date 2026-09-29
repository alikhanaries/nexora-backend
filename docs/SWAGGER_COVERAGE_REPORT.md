# Swagger / OpenAPI coverage report

**Generated:** `npm run docs:openapi-coverage`
**Inventory endpoints (static):** 147
**OpenAPI operations:** 147
**OpenAPI path entries:** 120

## Coverage summary

| Metric | Count |
| ------ | ----: |
| DOCUMENTED (inventory ↔ OpenAPI) | 147 |
| MISSING_FROM_SWAGGER | 0 |
| OpenAPI-only (not in inventory) | 0 |

## Final completeness audit (Phase 8)

| Metric | Actual result |
| ------ | -------------: |
| Total discovered unique registered endpoints (main server) | 147 |
| Total documented endpoints (OpenAPI operations matched) | 147 |
| Fully documented endpoints | 147 |
| Partially documented endpoints | 0 |
| Missing endpoints | 0 |
| Unresolved endpoints | 0 |
| Route-to-Swagger mappings verified | 147 |
| OpenAPI schema validation | OpenAPI 3.1.0 (`tests/integration/http.test.js`) |
| Swagger UI validation | Scalar `/docs`; alias `/api-docs` |
| Endpoints functionally tested | See testing section below |
| Unintended business logic changes | Doc URL routes + public auth patterns only |

## Route-to-Swagger mapping

| Route ID | HTTP Method | Full API Path | Inventory Status | Swagger Status | Schema Status | Verification |
| -------- | ----------- | ------------- | ---------------- | -------------- | ------------- | ------------ |
| R-0001 | GET | `/api-docs` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0002 | GET | `/api-docs.json` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0003 | GET | `/api/v1/api-keys` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0004 | POST | `/api/v1/api-keys` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0005 | POST | `/api/v1/api-keys/:apiKeyId/revoke` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0006 | POST | `/api/v1/api-keys/:apiKeyId/rotate` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0007 | GET | `/api/v1/audit` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0008 | POST | `/api/v1/auth/login` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0009 | POST | `/api/v1/auth/logout` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0010 | GET | `/api/v1/auth/me` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0011 | POST | `/api/v1/auth/refresh` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0012 | GET | `/api/v1/cancellations` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0013 | POST | `/api/v1/cancellations` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0014 | GET | `/api/v1/cancellations/:cancellationId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0015 | GET | `/api/v1/channels` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0016 | POST | `/api/v1/channels` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0017 | GET | `/api/v1/channels/:channelId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0018 | PATCH | `/api/v1/channels/:channelId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0019 | DELETE | `/api/v1/channels/:channelId/marketplace-connection` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0020 | GET | `/api/v1/channels/:channelId/marketplace-connection` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0021 | PATCH | `/api/v1/channels/:channelId/marketplace-connection` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0022 | POST | `/api/v1/channels/:channelId/marketplace-connection` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0023 | POST | `/api/v1/channels/:channelId/marketplace-connection/test` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0024 | POST | `/api/v1/foundation/echo` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0025 | GET | `/api/v1/foundation/ping` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0026 | POST | `/api/v1/inbound/marketplace-webhooks/:ingressToken` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0027 | GET | `/api/v1/inventory` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0028 | GET | `/api/v1/inventory/:productId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0029 | POST | `/api/v1/inventory/adjustments` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0030 | POST | `/api/v1/inventory/receipts` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0031 | POST | `/api/v1/inventory/releases` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0032 | POST | `/api/v1/inventory/reservations` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0033 | GET | `/api/v1/marketplaces` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0034 | POST | `/api/v1/marketplaces` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0035 | GET | `/api/v1/marketplaces/:id` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0036 | PATCH | `/api/v1/marketplaces/:id` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0037 | GET | `/api/v1/memberships/:membershipId/roles` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0038 | POST | `/api/v1/memberships/:membershipId/roles` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0039 | DELETE | `/api/v1/memberships/:membershipId/roles/:roleId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0040 | POST | `/api/v1/mfa/recovery-code/use` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0041 | POST | `/api/v1/mfa/totp/activate` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0042 | POST | `/api/v1/mfa/totp/start` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0043 | POST | `/api/v1/mfa/totp/verify` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0044 | POST | `/api/v1/mfa/verify` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0045 | GET | `/api/v1/offers` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0046 | POST | `/api/v1/offers` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0047 | GET | `/api/v1/offers/:offerId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0048 | PATCH | `/api/v1/offers/:offerId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0049 | POST | `/api/v1/offers/:offerId/activate` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0050 | GET | `/api/v1/orders` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0051 | POST | `/api/v1/orders` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0052 | GET | `/api/v1/orders/:orderId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0053 | POST | `/api/v1/orders/:orderId/cancel` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0054 | POST | `/api/v1/orders/:orderId/confirm` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0055 | POST | `/api/v1/orders/:orderId/returns` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0056 | POST | `/api/v1/orders/:orderId/shipments` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0057 | GET | `/api/v1/permissions` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0058 | GET | `/api/v1/prices` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0059 | POST | `/api/v1/prices` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0060 | GET | `/api/v1/prices/:priceId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0061 | PATCH | `/api/v1/prices/:priceId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0062 | GET | `/api/v1/products` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0063 | POST | `/api/v1/products` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0064 | GET | `/api/v1/products/:productId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0065 | PATCH | `/api/v1/products/:productId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0066 | POST | `/api/v1/products/:productId/archive` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0067 | GET | `/api/v1/products/:productId/content` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0068 | PUT | `/api/v1/products/:productId/content/:locale` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0069 | POST | `/api/v1/products/:productId/deactivate` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0070 | GET | `/api/v1/returns` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0071 | GET | `/api/v1/returns/:returnId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0072 | POST | `/api/v1/returns/:returnId/approve` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0073 | POST | `/api/v1/returns/:returnId/cancel` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0074 | POST | `/api/v1/returns/:returnId/complete` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0075 | POST | `/api/v1/returns/:returnId/receive` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0076 | POST | `/api/v1/returns/:returnId/reject` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0077 | GET | `/api/v1/roles` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0078 | POST | `/api/v1/roles` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0079 | GET | `/api/v1/shipments` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0080 | GET | `/api/v1/shipments/:shipmentId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0081 | POST | `/api/v1/shipments/:shipmentId/cancel` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0082 | POST | `/api/v1/shipments/:shipmentId/deliver` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0083 | POST | `/api/v1/shipments/:shipmentId/ship` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0084 | GET | `/api/v1/stock-locations` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0085 | POST | `/api/v1/stock-locations` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0086 | GET | `/api/v1/stock-locations/:stockLocationId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0087 | POST | `/api/v1/tenants` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0088 | GET | `/api/v1/tenants/:tenantId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0089 | POST | `/api/v1/tenants/:tenantId/close` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0090 | POST | `/api/v1/tenants/:tenantId/reactivate` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0091 | POST | `/api/v1/tenants/:tenantId/suspend` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0092 | GET | `/api/v1/webhooks` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0093 | POST | `/api/v1/webhooks` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0094 | DELETE | `/api/v1/webhooks/:webhookId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0095 | GET | `/api/v1/webhooks/:webhookId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0096 | PATCH | `/api/v1/webhooks/:webhookId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0097 | GET | `/api/v1/webhooks/:webhookId/deliveries` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0098 | GET | `/api/v1/webhooks/:webhookId/deliveries/:deliveryId` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0099 | POST | `/api/v1/webhooks/:webhookId/rotate-secret` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0100 | POST | `/api/v2/cancellations` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0101 | GET | `/api/v2/cancellations/merchant` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0102 | POST | `/api/v2/ce/cancellations` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0103 | GET | `/api/v2/ce/channels` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0104 | GET | `/api/v2/ce/channels/:channelId/products` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0105 | PUT | `/api/v2/ce/offer` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0106 | PUT | `/api/v2/ce/offer/stock` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0107 | GET | `/api/v2/ce/orders` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0108 | GET | `/api/v2/ce/orders/:merchantOrderNo/invoice` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0109 | POST | `/api/v2/ce/orders/acknowledge` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0110 | GET | `/api/v2/ce/products` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0111 | POST | `/api/v2/ce/products` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0112 | POST | `/api/v2/ce/products/bulkdelete` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0113 | PATCH | `/api/v2/ce/products/extra-data/bulk` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0114 | POST | `/api/v2/ce/products/freeze` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0115 | GET | `/api/v2/ce/returns` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0116 | PUT | `/api/v2/ce/returns` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0117 | POST | `/api/v2/ce/returns/merchant` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0118 | POST | `/api/v2/ce/returns/merchant/acknowledge` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0119 | POST | `/api/v2/ce/shipments` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0120 | PUT | `/api/v2/ce/shipments/:merchantShipmentNo/delivery-state` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0121 | GET | `/api/v2/ce/shipments/merchant` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0122 | GET | `/api/v2/foundation/ping` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0123 | PUT | `/api/v2/offer` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0124 | PUT | `/api/v2/offer/stock` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0125 | GET | `/api/v2/orders` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0126 | POST | `/api/v2/orders` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0127 | POST | `/api/v2/orders/acknowledge` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0128 | POST | `/api/v2/orders/channel-fulfilled` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0129 | GET | `/api/v2/orders/new` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0130 | GET | `/api/v2/products` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0131 | POST | `/api/v2/products` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0132 | POST | `/api/v2/products/bulkdelete` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0133 | PATCH | `/api/v2/products/extra-data/bulk` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0134 | POST | `/api/v2/products/freeze` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0135 | POST | `/api/v2/returns` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0136 | PUT | `/api/v2/returns` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0137 | GET | `/api/v2/returns/merchant` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0138 | GET | `/api/v2/returns/merchant/:merchantOrderNo` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0139 | POST | `/api/v2/returns/merchant/acknowledge` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0140 | GET | `/api/v2/returns/merchant/new` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0141 | POST | `/api/v2/shipments` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0142 | PUT | `/api/v2/shipments/:merchantShipmentNo` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0143 | GET | `/api/v2/shipments/merchant` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0144 | GET | `/health/live` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0145 | GET | `/health/ready` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0146 | GET | `/internal/metrics` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |
| R-0147 | GET | `/openapi.json` | CONFIRMED | DOCUMENTED | VERIFIED | MATCH |

## Swagger access (local)

| Surface | URL |
| ------- | --- |
| Swagger UI (Scalar) | `http://localhost:<SERVER_PORT>/docs` |
| Swagger UI alias | `http://localhost:<SERVER_PORT>/api-docs` |
| OpenAPI JSON | `http://localhost:<SERVER_PORT>/openapi.json` |
| OpenAPI JSON alias | `http://localhost:<SERVER_PORT>/api-docs.json` |

Requires `DOCS_ENABLED=true` (default in development/test).

## Testing

- **Unit regression:** `npm run test:unit` — 623 tests passed (last run during audit).
- **Integration (HTTP):** `tests/integration/http.test.js` — `/health/live` and OpenAPI pass; `/health/ready` returned **503** in this environment (readiness probe dependency; pre-existing, unrelated to Swagger).
- **Coverage automation:** `npm run docs:openapi-coverage` dumps live spec and regenerates this report.

## Notes

- Nexora uses **Fastify + `@fastify/swagger` + Zod** (`fastify-type-provider-zod`), not Express/Swagger-JSDoc.
- Worker observability routes are inventory-only (separate HTTP listener).
- Per-route request/response detail lives in route Zod schemas under each module’s `presentation/*.schemas.js`.

