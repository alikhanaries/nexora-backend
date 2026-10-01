# Migration Phase 9 — Orders & Order Management HTTP APIs

## Phase objective

Expose the existing **tenant-scoped order HTTP APIs** on NestJS (JavaScript only), reusing `createOrdersModule` use cases, Zod schemas, mappers, idempotency, and authorization. Fastify `order.routes.js` remains registered unchanged.

## Scope

In-scope routes are those defined in `src/modules/orders/presentation/order.routes.js` only.

**Out of scope (separate modules / later phases):**

- `POST /api/v1/orders/:orderId/cancel` (cancellations)
- `POST /api/v1/orders/:orderId/shipments` (shipments)
- `POST /api/v1/orders/:orderId/returns` (returns)
- `/api/v2/orders*` and `/api/v2/ce/orders*` (compatibility)
- Marketplace webhook ingress (Phase 8)

## Route inventory (Fastify source of truth)

| Route ID | Method | Path | Auth | Permissions (use case) |
|----------|--------|------|------|-------------------------|
| R-0050 | GET | `/api/v1/orders` | Bearer / x-api-key | `orders.read` |
| R-0051 | POST | `/api/v1/orders` | Bearer / x-api-key | `orders.create` + `Idempotency-Key` |
| R-0052 | GET | `/api/v1/orders/:orderId` | Bearer / x-api-key | `orders.read` |
| R-0054 | POST | `/api/v1/orders/:orderId/confirm` | Bearer / x-api-key | `orders.update` |

**Fastify order routes counted:** 4

## Migrated NestJS routes

| Method | Path | Status | Handler |
|--------|------|--------|---------|
| GET | `/api/v1/orders` | 200 | `OrdersController.list` |
| POST | `/api/v1/orders` | 201 | `OrdersController.create` |
| GET | `/api/v1/orders/:orderId` | 200 | `OrdersController.getById` |
| POST | `/api/v1/orders/:orderId/confirm` | 200 | `OrdersController.confirm` |

**NestJS order routes counted:** 4

## Route parity

| Metric | Value |
|--------|-------|
| Fastify routes | 4 |
| NestJS routes | 4 |
| Matched | 4 |
| Missing | 0 |
| Unexpected | 0 |

**Result: PASS**

Compared per route: method, path, auth (global `AuthGuard`), query/body schemas (`order.schemas.js`), response envelopes (`success` + `data`), create idempotency (`POST /api/v1/orders`, `Idempotency-Key`, transactional idempotency), list pagination shape (`items`, `nextCursor`, `hasMore`).

## Authorization

Same as Fastify:

- Global Nest `AuthGuard` (Bearer / API key) — no `@Public()` on order routes.
- Use cases enforce permissions via `order-permissions.js`:
  - List / get → `orders.read`
  - Create → `orders.create`
  - Confirm → `orders.update`
- Tenant scope: `requireActorContext().tenantId` passed into every use case.

No seller-specific HTTP routes exist on the core orders module; tenant isolation is unchanged.

## Validation

Reused schemas from `src/modules/orders/presentation/order.schemas.js`:

- `createOrderBodySchema`
- `listOrdersQuerySchema` (cursor, limit, status enum, channelId, filters, ISO datetimes)
- `orderIdParamsSchema`

Response mapping via existing `order.mapper.js` (`toOrderResponse`, `toOrderDetailResponse`).

## Business logic reused

- `createOrdersModule` wired in `wire-core-domain.js` with the same dependencies as `create-application.js` (products, channels, offers, pricing, inventory, idempotency, external integer id mapping, audit, outbox).
- Use cases: `CreateOrder`, `ListOrders`, `GetOrder`, `ConfirmOrder`, `PostgresIdempotencyService` (via `useCases.idempotency`).
- **Not wired in Nest:** `wireChannelFulfilledOrder` (only needed for compatibility v2 routes, out of scope).

Marketplace lifecycle / webhook order creation paths are unchanged (Phase 8).

## Files created / changed

**Created**

- `src/nest/orders/orders.module.js`
- `src/nest/orders/orders.controller.js`
- `src/nest/orders/orders.service.js`
- `test/nest/orders.test.js`
- `docs/migration-phase-9-orders.md`

**Changed**

- `src/nest/app.module.js` — register `OrdersModule`
- `src/nest/bootstrap/wire-core-domain.js` — `createExternalIdMappingModule`, `createOrdersModule`, expose `orders`
- `test/nest/helpers/mock-core-domain.js` — mock `orders.useCases`

**Unchanged**

- `src/modules/orders/presentation/order.routes.js` (Fastify)

## Tests executed

| Suite | Command | Result |
|-------|---------|--------|
| Jest (Nest) | `npm run test:jest` | **PASS** — 8 suites, **50** tests |
| Vitest (unit) | `npm run test:unit` | **PASS** — 136 files, **623** tests |
| Syntax | `npm run build` | **PASS** — 1046 JavaScript files |

Nest order tests cover: auth required, list/detail/confirm/create, query forwarding, idempotency header, param validation, authorization error mapping, route count parity.

## Authorization verification

- **Jest:** unauthenticated → 401; mocked `AuthorizationError` from list → 403.
- **Route-by-route Fastify vs Nest permission matrix:** verified by code parity (same use case + `requireActorContext`); no live multi-tenant DB test.

## Startup verification

```text
NestJS startup: NOT VERIFIED — PostgreSQL + Redis required for full bootstrap.
Fastify startup: NOT VERIFIED — same.
```

## Known limitations

- Cancel / shipment / return order subpaths remain Fastify-only until their migration phases.
- Compatibility v2 order APIs not migrated.
- End-to-end order create against real inventory/pricing not run without Postgres.

## Remaining work

- Phase 10+ (suggested): cancellations, shipments, returns HTTP modules; compatibility order routes as planned.
