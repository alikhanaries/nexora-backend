# Migration Phase 10 — Order Cancellation, Shipments & Returns

## Phase objective

Migrate existing **cancellation**, **shipment**, and **return** HTTP APIs to NestJS (JavaScript only), reusing `createCancellationsModule`, `createShipmentsModule`, and `createReturnsModule` with the same use cases, schemas, mappers, and idempotency as Fastify. Phase 9 core order routes and Phase 8 webhooks are unchanged.

## Scope

All routes from:

- `src/modules/cancellations/presentation/cancellation.routes.js`
- `src/modules/shipments/presentation/shipment.routes.js`
- `src/modules/returns/presentation/return.routes.js`

**Out of scope:** compatibility `/api/v2/orders*`, outbound tenant webhooks, new providers.

## Fastify route inventory

### Cancellations (4)

| Method | Path | Idempotency | Permission notes |
|--------|------|-------------|------------------|
| GET | `/api/v1/cancellations` | — | `cancellations.read` (use case) |
| POST | `/api/v1/cancellations` | `Idempotency-Key` | `cancellations.create` |
| GET | `/api/v1/cancellations/:cancellationId` | — | read |
| POST | `/api/v1/orders/:orderId/cancel` | — | `orders.cancel` via `createCancellation` |

### Shipments (6)

| Method | Path | Idempotency |
|--------|------|-------------|
| POST | `/api/v1/orders/:orderId/shipments` | yes |
| GET | `/api/v1/shipments` | — |
| GET | `/api/v1/shipments/:shipmentId` | — |
| POST | `/api/v1/shipments/:shipmentId/ship` | — |
| POST | `/api/v1/shipments/:shipmentId/deliver` | — |
| POST | `/api/v1/shipments/:shipmentId/cancel` | — |

### Returns (8)

| Method | Path | Idempotency |
|--------|------|-------------|
| POST | `/api/v1/orders/:orderId/returns` | yes |
| GET | `/api/v1/returns` | — |
| GET | `/api/v1/returns/:returnId` | — |
| POST | `/api/v1/returns/:returnId/approve` | — |
| POST | `/api/v1/returns/:returnId/receive` | — |
| POST | `/api/v1/returns/:returnId/complete` | — |
| POST | `/api/v1/returns/:returnId/reject` | — |
| POST | `/api/v1/returns/:returnId/cancel` | — |

**Fastify total:** 18 routes

## NestJS route inventory

Same 18 routes implemented in:

- `CancellationsController` (3) + `OrdersController.cancel` (1)
- `ShipmentsController` (6)
- `ReturnsController` (8)

**Nest total:** 18 routes

## Route parity

| Metric | Value |
|--------|-------|
| Fastify | 18 |
| NestJS | 18 |
| Matched | 18 |
| Missing | 0 |
| Unexpected | 0 |

**Result: PASS**

## Wiring

`wire-core-domain.js` mirrors Fastify `create-application.js` order-adjacent factories (after `createOrdersModule`):

- `createCancellationsModule` — order query/fulfillment + inventory + idempotency
- `createShipmentsModule` — order fulfillment/query + inventory + idempotency
- `createReturnsModule` — `orderReturnGateway` + inventory + idempotency

`orders.wireChannelFulfilledOrder` is **not** wired in Nest (compatibility-only; no HTTP in Phase 10).

## Authorization & validation

- Global `AuthGuard` on all routes.
- Existing Zod schemas from each module’s `presentation/*.schemas.js`.
- Existing mappers for response shapes.
- Idempotency: `PostgresIdempotencyService` with same `routeId` strings as Fastify for POST create paths.

## Files created / changed

**Created**

- `src/nest/cancellations/*`
- `src/nest/shipments/*`
- `src/nest/returns/*`
- `test/nest/order-adjacent-apis.test.js`
- `docs/migration-phase-10-order-adjacent-apis.md`

**Changed**

- `src/nest/app.module.js`
- `src/nest/bootstrap/wire-core-domain.js`
- `src/nest/orders/orders.controller.js` — `POST .../cancel`
- `src/nest/orders/orders.module.js` — imports `CancellationsModule` for cancel DI
- `test/nest/helpers/mock-core-domain.js`

**Unchanged (Fastify)**

- `cancellation.routes.js`, `shipment.routes.js`, `return.routes.js`
- Phase 9 `orders.controller.js` core four routes (only cancel added)

## Tests

| Suite | Result |
|-------|--------|
| `npm run test:jest` | **PASS** — 9 suites, **60** tests |
| `npm run test:unit` | **PASS** — 136 files, **623** tests |
| `npm run build` | **PASS** — syntax check |

## Startup

```text
NestJS startup: NOT VERIFIED — PostgreSQL/Redis required.
Fastify startup: NOT VERIFIED — same.
```

## Authorization verification

Jest covers unauthenticated access, idempotency headers, and mocked success paths with `permission: 'orders.cancel'` on order cancel. Full permission matrix verified by code parity with Fastify use cases; no live DB multi-tenant test.

## Remaining Fastify-only order-related HTTP

- `/api/v2/orders`, `/api/v2/orders/new`, `/api/v2/orders/acknowledge`, `/api/v2/orders/channel-fulfilled` (compatibility)
- `/api/v2/ce/orders*`

## Recommended next phase

Compatibility v2 order APIs and/or outbound tenant webhooks module, per migration roadmap.
