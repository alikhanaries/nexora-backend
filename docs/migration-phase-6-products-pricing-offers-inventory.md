# Migration Phase 6 — Products, Pricing, Offers & Inventory

## Phase objective

Migrate catalog/commerce HTTP endpoints for **products**, **pricing**, **offers**, and **inventory** into NestJS (Express), reusing existing module factories and use cases. Channels and marketplaces are wired only as dependencies (no channel HTTP routes on Nest).

## Migrated modules

- **ProductsModule** — 9 routes  
- **PricingModule** — 4 routes  
- **OffersModule** — 5 routes  
- **InventoryModule** — 10 routes  

**Total: 28 routes** (Phase 4–5 routes unchanged).

## Route parity

| Module | Routes | Status |
|--------|--------|--------|
| Products | `GET/POST /api/v1/products`, `GET/PATCH /api/v1/products/:id`, `POST .../deactivate`, `POST .../archive`, content GET/PUT | PASS |
| Pricing | `GET/POST /api/v1/prices`, `GET/PATCH /api/v1/prices/:priceId` | PASS |
| Offers | `GET/POST /api/v1/offers`, `GET/PATCH /api/v1/offers/:offerId`, `POST .../activate` | PASS |
| Inventory | stock locations (3), inventory list (2), adjustments/receipts/reservations/releases | PASS |

Status codes match Fastify (`201` for creates, `200` for PATCH/POST mutations unless Fastify used `reply.status` — mirrored with `@HttpCode`).

## Business logic reused

- `createProductsModule`, `createPricingModule`, `createOffersModule`, `createInventoryModule`
- Supporting wiring (not exposed as Nest HTTP): `createMarketplacesModule`, `createChannelsModule`, `PostgresOutboxRepository` as `eventRecorder`
- Mappers and Zod schemas from `src/modules/*/presentation/`
- `requireActorContext`, `withCommerceMetric`, `optionalReferenceFields`, actor field rules via `commerce-actor.js`

## Authorization

Unchanged — use cases enforce permissions via existing `DefaultAuthorizationService` inside module factories.

## Database

Same Postgres connection from Nest infrastructure; no schema changes.

## Tests

- `test/nest/catalog-modules.test.js` — auth gates and sample list responses per module
- `test/nest/helpers/mock-core-domain.js` — extended for catalog use cases

## Startup verification

```text
NestJS startup: NOT VERIFIED — PostgreSQL/Redis unavailable in CI agent environment
Fastify startup: NOT VERIFIED — same
```

## Files changed (important)

- `src/nest/bootstrap/wire-core-domain.js`
- `src/nest/products/*`, `pricing/*`, `offers/*`, `inventory/*`
- `src/nest/common/commerce-actor.js`
- `src/nest/app.module.js`
- `test/nest/catalog-modules.test.js`, `helpers/mock-core-domain.js`

## Dependencies

None

## Known limitations

- **Channels** and **marketplaces** HTTP routes remain Fastify-only; modules are wired for `channelQueryService` / validation only.
- Phase 5 PR `#82` was **open** at branch creation; Phase 6 branch is based on `migration/nest-express-phase-5` (`c9b35f0`). Rebase onto `dev` after Phase 5 merges if needed.

## Phase 7 recommendation

Migrate **orders**, **shipments**, **returns**, **cancellations**, or **channels** HTTP surface (pick one cohesive slice). Keep marketplace webhooks and compatibility on Fastify until a dedicated phase.
