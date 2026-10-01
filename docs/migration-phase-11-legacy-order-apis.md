# Migration Phase 11 — Legacy Order Compatibility APIs

## Phase objective

Migrate existing **`/api/v2/orders*`** and **`/api/v2/ce/orders*`** HTTP routes to NestJS (JavaScript only), preserving Merchant / StockConnect CE contracts, rate limits, idempotency, and external error envelopes. Phases 8–10 routes unchanged.

## Scope

**In scope (8 routes):** order-related paths only from:

- `src/modules/compatibility/presentation/compatibility.routes.js`
- `src/modules/compatibility/presentation/stockconnect-ce.routes.js`

**Out of scope (remain Fastify-only for now):**

- `/api/v2/foundation/ping`
- `/api/v2/shipments*`, `/api/v2/cancellations*`, `/api/v2/returns*`
- `/api/v2/products*`, `/api/v2/offer*`
- Other `/api/v2/ce/*` (products, channels, shipments, returns, cancellations, catalog mutations)

## `/api/v2/orders*` inventory (Fastify)

| Method | Path | Idempotency | Underlying service |
|--------|------|-------------|-------------------|
| GET | `/api/v2/orders` | — | `orderCompatibilityQuery.listOrders` |
| GET | `/api/v2/orders/new` | — | `orderCompatibilityQuery.listNewOrders` |
| POST | `/api/v2/orders` | `Idempotency-Key` (required) | `orderCompatibilityCommand.createChannelOrder` |
| POST | `/api/v2/orders/channel-fulfilled` | required | `orderCompatibilityCommand.createChannelFulfilledOrder` |
| POST | `/api/v2/orders/acknowledge` | required | `orderCompatibilityCommand.acknowledgeOrder` |

**Count: 5**

## `/api/v2/ce/orders*` inventory (Fastify)

| Method | Path | Idempotency | Underlying service |
|--------|------|-------------|-------------------|
| GET | `/api/v2/ce/orders/:merchantOrderNo/invoice` | — | `stockConnectCeOrderInvoiceQuery.getOrderInvoice` (PDF) |
| GET | `/api/v2/ce/orders` | — | `stockConnectCeOrderCompatibilityQuery.listOrdersForStockConnectPoll` |
| POST | `/api/v2/ce/orders/acknowledge` | optional (CE deterministic key) | `orderCompatibilityCommand.acknowledgeOrder` |

**Count: 3**

## NestJS route inventory

Same 8 routes on:

- `LegacyOrdersV2Controller` (5)
- `ChannelEngineOrdersController` (3)

## Route parity

| Metric | Value |
|--------|-------|
| Fastify (in-scope) | 8 |
| NestJS | 8 |
| Matched | 8 |
| Missing | 0 |
| Unexpected | 0 |

**Result: PASS**

## Authentication & authorization

- Global Nest `AuthGuard` (Bearer / API key), same as other v2 routes.
- Compatibility **read/mutation rate limits** via `enforceCompatibilityRateLimit` + Redis rate limiter (when infra connected).
- Channel context: `apiKeyChannelId` on actor + `X-Channel-Reference` header for channel ingest routes.
- Permissions enforced inside existing compatibility command/query services (`orders.ingest`, `orders.read`, etc.).

## Validation

Existing Zod schemas from `src/modules/compatibility/presentation/*.schemas.js` (PascalCase query fields preserved).

## Idempotency

- v2 POST orders: `requireIdempotencyKey` (same as Fastify).
- CE acknowledge: `resolveStockConnectCeIdempotencyKey` when header omitted.

## Error handling

- `@UseFilters(CompatibilityExceptionFilter)` on legacy order controllers → `mapCoreErrorToExternalApiResponse` (`Success: false`, `StatusCode`, `ValidationErrors`, `retry-after` on rate limit).

## Business logic reused

- `createCompatibilityModule` wired in `wire-compatibility.js` (mirrors `create-application.js` coreContracts).
- `orders.wireChannelFulfilledOrder(...)` for channel-fulfilled ingest (same as Fastify).
- No duplicate order/compatibility logic in Nest services — delegation to `compatibility.routeDeps`.

## Files created / changed

**Created**

- `src/nest/legacy-orders/legacy-orders.module.js`
- `src/nest/legacy-orders/legacy-orders.service.js`
- `src/nest/legacy-orders/legacy-orders-v2.controller.js`
- `src/nest/legacy-orders/channel-engine-orders.controller.js`
- `src/nest/bootstrap/wire-compatibility.js`
- `src/nest/common/filters/compatibility-exception.filter.js`
- `test/nest/legacy-orders.test.js`
- `docs/migration-phase-11-legacy-order-apis.md`

**Changed**

- `src/nest/app.module.js`
- `src/nest/bootstrap/wire-core-domain.js`
- `test/nest/helpers/mock-core-domain.js`

**Unchanged**

- Fastify `compatibility.routes.js`, `stockconnect-ce.routes.js`

## Tests

| Suite | Result |
|-------|--------|
| `npm run test:jest` | **PASS** — 10 suites, **69** tests |
| `npm run test:unit` | **PASS** — 136 files, **623** tests |
| `npm run build` | **PASS** — syntax check |

## Startup

```text
NestJS startup: NOT VERIFIED — PostgreSQL/Redis required for full wiring.
Fastify startup: NOT VERIFIED — same.
```

## Compatibility verification

Jest covers v2/CE envelopes, idempotency (required vs CE deterministic), PDF invoice response, and mocked service delegation. No live ChannelEngine or Merchant client E2E test.

## Remaining Fastify-only APIs

- All other `/api/v2/*` and `/api/v2/ce/*` routes listed under out of scope above.
- Outbound tenant webhooks (future phase).

## Recommended next phase

Migrate remaining **compatibility v2** surfaces (shipments, cancellations, returns, catalog) and/or **outbound tenant webhooks**, in separate PRs to keep reviews focused.
