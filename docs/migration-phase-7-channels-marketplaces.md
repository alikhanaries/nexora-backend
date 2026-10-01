# Migration Phase 7 — Channels & Marketplaces

## Phase objective

Expose existing **channel** and **global marketplace definition** HTTP APIs on NestJS, including marketplace connection CRUD/test on channels. Reuse Fastify use cases and connection services.

## Migrated modules

- **ChannelsModule** — 10 routes  
- **MarketplacesModule** — 4 routes  

**Total: 14 routes** (Phases 4–6 unchanged).

## Route inventory & parity

### Channels (PASS)

| Method | Path |
|--------|------|
| GET | `/api/v1/channels` |
| POST | `/api/v1/channels` (201) |
| GET | `/api/v1/channels/:channelId` |
| PATCH | `/api/v1/channels/:channelId` |
| POST | `/api/v1/channels/:channelId/marketplace-connection` (201) |
| GET | `/api/v1/channels/:channelId/marketplace-connection` |
| PATCH | `/api/v1/channels/:channelId/marketplace-connection` |
| DELETE | `/api/v1/channels/:channelId/marketplace-connection` → `{ success: true }` |
| POST | `/api/v1/channels/:channelId/marketplace-connection/test` → `{ success: true }` |

### Marketplaces (PASS)

| Method | Path |
|--------|------|
| GET | `/api/v1/marketplaces` |
| POST | `/api/v1/marketplaces` (201) |
| GET | `/api/v1/marketplaces/:id` |
| PATCH | `/api/v1/marketplaces/:id` |

## Marketplace webhooks

**NOT MIGRATED** — `/api/v1/inbound/marketplace-webhooks/*`, order lifecycle webhooks, and related ingestion remain Fastify-only (dedicated later phase).

## Authorization & credentials

- Same `requireActorContext` + use-case permission checks as Fastify.  
- Connection credentials use existing `createMarketplaceConnectionServices` + encryptor from identity module; no change to secret handling.

## Business logic reused

- `createChannelsModule`, `createMarketplacesModule`, `createMarketplaceConnectionServices`  
- `channelRouteDeps` mirrors Fastify `channelRouteDeps` in `create-application.js`  
- Presentation mappers/schemas unchanged  

## Database

No schema changes; same Postgres connection.

## Tests

- `test/nest/channels-marketplaces.test.js`  
- Extended `mock-core-domain.js` with `channelRouteDeps` and `marketplaces.useCases`  

## Startup verification

```text
NestJS startup: NOT VERIFIED — PostgreSQL/Redis unavailable
Fastify startup: NOT VERIFIED — PostgreSQL/Redis unavailable
```

## Files changed

- `src/nest/bootstrap/wire-core-domain.js` — `channelRouteDeps`, expose `channels`/`marketplaces`  
- `src/nest/channels/*`, `src/nest/marketplaces/*`, `app.module.js`  
- `test/nest/channels-marketplaces.test.js`  

## Dependencies

None

## Known limitations

- Phase 6 PR **#83** may still be open; Phase 7 branch stacks Phase 5 (duplicate on `dev` via #82), Phase 6, and Phase 7 until rebased onto merged `dev`.  
- Channel catalog sync / marketplace adapter HTTP not in scope.

## Phase 8 recommendation

Migrate **orders** and related fulfillment slices (shipments, returns, cancellations) or **webhooks** module (outbound tenant webhooks, not marketplace inbound) per audit priority.
