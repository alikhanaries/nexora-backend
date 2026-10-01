# Migration Phase 12 — Remaining Compatibility APIs

## Objective

Migrate all Fastify-only `/api/v2/*` and `/api/v2/ce/*` compatibility routes **except** those already migrated in Phase 11 (`/api/v2/orders*`, `/api/v2/ce/orders*`), preserving exact contracts and reusing `compatibility.routeDeps`.

## Route audit (Fastify source of truth)

Registered in:

- `src/modules/compatibility/presentation/compatibility.routes.js`
- `src/modules/compatibility/presentation/stockconnect-ce.routes.js`

### Phase 11 (excluded — already on Nest)

| Method | Path |
|--------|------|
| GET | `/api/v2/orders` |
| GET | `/api/v2/orders/new` |
| POST | `/api/v2/orders` |
| POST | `/api/v2/orders/channel-fulfilled` |
| POST | `/api/v2/orders/acknowledge` |
| GET | `/api/v2/ce/orders/:merchantOrderNo/invoice` |
| GET | `/api/v2/ce/orders` |
| POST | `/api/v2/ce/orders/acknowledge` |

### Phase 12 — `/api/v2/*` (19 routes)

| Category | Method | Path |
|----------|--------|------|
| Other | GET | `/api/v2/foundation/ping` |
| Shipments | GET | `/api/v2/shipments/merchant` |
| Shipments | POST | `/api/v2/shipments` |
| Shipments | PUT | `/api/v2/shipments/:merchantShipmentNo` |
| Cancellations | GET | `/api/v2/cancellations/merchant` |
| Cancellations | POST | `/api/v2/cancellations` |
| Returns | GET | `/api/v2/returns/merchant/new` |
| Returns | GET | `/api/v2/returns/merchant/:merchantOrderNo` |
| Returns | GET | `/api/v2/returns/merchant` |
| Returns | PUT | `/api/v2/returns` |
| Returns | POST | `/api/v2/returns/merchant/acknowledge` |
| Returns | POST | `/api/v2/returns` |
| Catalog | GET | `/api/v2/products` |
| Catalog | POST | `/api/v2/products` |
| Catalog | POST | `/api/v2/products/freeze` |
| Catalog | POST | `/api/v2/products/bulkdelete` |
| Catalog | PATCH | `/api/v2/products/extra-data/bulk` |
| Catalog | PUT | `/api/v2/offer` |
| Catalog | PUT | `/api/v2/offer/stock` |

### Phase 12 — `/api/v2/ce/*` (17 routes)

| Category | Method | Path |
|----------|--------|------|
| Cancellations | POST | `/api/v2/ce/cancellations` |
| Shipments | POST | `/api/v2/ce/shipments` |
| Shipments | GET | `/api/v2/ce/shipments/merchant` |
| Shipments | PUT | `/api/v2/ce/shipments/:merchantShipmentNo/delivery-state` |
| Returns | GET | `/api/v2/ce/returns` |
| Returns | POST | `/api/v2/ce/returns/merchant` |
| Returns | POST | `/api/v2/ce/returns/merchant/acknowledge` |
| Returns | PUT | `/api/v2/ce/returns` |
| Catalog | GET | `/api/v2/ce/products` |
| Catalog | GET | `/api/v2/ce/channels/:channelId/products` |
| Channels | GET | `/api/v2/ce/channels` |
| Catalog | POST | `/api/v2/ce/products` |
| Catalog | PUT | `/api/v2/ce/offer/stock` |
| Catalog | PUT | `/api/v2/ce/offer` |
| Catalog | POST | `/api/v2/ce/products/freeze` |
| Catalog | POST | `/api/v2/ce/products/bulkdelete` |
| Catalog | PATCH | `/api/v2/ce/products/extra-data/bulk` |

### Routes intentionally deferred

None within the compatibility surface. All non–Phase 11 compatibility HTTP routes from the two Fastify route files are in scope for Phase 12.

Outbound tenant webhooks and other non-`/api/v2` surfaces remain future phases.

## Route parity (Phase 12 scope)

| | Count |
|--|------|
| Fastify Phase 12 routes | 36 |
| Nest Phase 12 routes | 36 |
| Missing | 0 |
| Unexpected | 0 |

Full compatibility surface (Phase 11 + 12): **44** Fastify routes = **44** Nest routes.

## Nest implementation

```
src/nest/legacy-compatibility/
├── legacy-compatibility.module.js
├── legacy-compatibility.service.js      → compatibility.routeDeps + rate limits
├── compatibility-v2.controller.js       → /api/v2/* (non-order)
└── channel-engine-compatibility.controller.js → /api/v2/ce/* (non-order)
```

Phase 11 remains in `src/nest/legacy-orders/`.

- **Errors:** `CompatibilityExceptionFilter` + `mapCoreErrorToExternalApiResponse` on both controllers.
- **Rate limits:** `COMPATIBILITY_RATE_LIMIT_POLICIES` read/mutation via shared `LegacyOrdersService` helpers.
- **Idempotency:** v2 mutations require `Idempotency-Key` header (same as Fastify). CE mutations use `resolveStockConnectCeIdempotencyKey` when header omitted.
- **Auth:** Bearer / `X-Api-Key` / `ApiKey` for v2; CE paths also accept query `apiKey`/`apikey` and `X-CE-KEY` (Nest `AuthGuard` aligned with Fastify `authentication.plugin.js`).

## Services reused

All handlers delegate to existing `routeDeps`:

- `shipmentCompatibilityQuery` / `shipmentCompatibilityCommand`
- `cancellationCompatibilityQuery` / `cancellationCompatibilityCommand`
- `returnCompatibilityQuery` / `returnCompatibilityCommand`
- `catalogCompatibilityQuery` / `catalogCompatibilityCommand`
- `stockConnectCeProductsQuery` / `stockConnectCeChannelProductsQuery`
- `stockConnectCeChannelCompatibilityQuery`
- `stockConnectCeCatalogCommand`
- `stockConnectCeShipmentDeliveryCommand`

## Files created/changed

**Created**

- `src/nest/legacy-compatibility/*`
- `test/nest/legacy-compatibility.test.js`
- `docs/migration-phase-12-remaining-compatibility-apis.md`

**Changed**

- `src/nest/app.module.js` — register `LegacyCompatibilityModule`
- `src/nest/legacy-orders/legacy-orders.module.js` — export `LegacyOrdersService`
- `src/nest/common/guards/auth.guard.js` — CE query/header API key auth
- `test/nest/helpers/mock-core-domain.js` — extended `routeDeps` mocks
- `tests/unit/architecture/platform-independence.test.js` — allow `legacy-compatibility` imports

## Test results

| Suite | Result |
|-------|--------|
| Jest (`npm run test:jest`) | **PASS** — 11 suites, **83** tests |
| Vitest (`npm run test:unit`) | **PASS** — 136 files, **623** tests |
| Build (`npm run build`) | **PASS** |

## Runtime verification

| Check | Result |
|-------|--------|
| NestJS startup against Postgres/Redis | **NOT VERIFIED** |
| Fastify startup | **NOT VERIFIED** |
| Live compatibility endpoints | **NOT VERIFIED** |

## Remaining Fastify-only APIs

After Phase 11 + 12, **all** routes from `compatibility.routes.js` and `stockconnect-ce.routes.js` are duplicated on Nest. Fastify registration is unchanged (incremental migration; no cutover).

Still Fastify-only (outside this compatibility surface):

- Outbound tenant webhooks
- Any future routes not yet added to the compatibility modules

## Recommended next phase

**Outbound tenant webhooks** migration to Nest, or production cutover planning once runtime parity is verified with Postgres/Redis.
