# Migration Phase 8 — Marketplace Webhooks & Inbound Lifecycle

## Phase objective

Migrate the **inbound marketplace webhook** HTTP ingress and wiring into NestJS (JavaScript only), reusing the existing `ReceiveMarketplaceWebhook` use case, adapter registry, `PostgresIdempotencyService`, and `MarketplaceLifecycleEnqueueService`. Fastify routes remain unchanged.

## Scope

- Generic provider-neutral ingress: `POST /api/v1/inbound/marketplace-webhooks/:ingressToken`
- Ingress token resolution, HMAC/signature verification (via existing adapters), normalized events, idempotency, lifecycle job enqueue
- **Out of scope:** outbound tenant webhooks, orders/shipments/returns HTTP APIs, new marketplace providers

## Existing Fastify routes (source of truth)

| Route ID | Method | Path | Source |
|----------|--------|------|--------|
| R-0026 | POST | `/api/v1/inbound/marketplace-webhooks/:ingressToken` | `src/modules/marketplace-webhook-ingestion/presentation/marketplace-webhook.routes.js` |

No other Fastify marketplace webhook HTTP routes were found in the codebase audit.

## Migrated NestJS routes

| Method | Path | Controller |
|--------|------|------------|
| POST | `/api/v1/inbound/marketplace-webhooks/:ingressToken` | `WebhooksController.receiveMarketplaceWebhook` |

### Route parity (PASS)

| Check | Fastify | Nest |
|-------|---------|------|
| Method | POST | POST |
| Path | `/api/v1/inbound/marketplace-webhooks/:ingressToken` | Same |
| Auth | Public (ingress token + adapter auth) | `@Public()` + same use case |
| Params | `ingressToken` min 16 max 128 | Same Zod schema |
| Response 200 | `{ success, data: { outcome, externalOrderReference }, replayed }` | Same |
| Headers | Lower-cased map passed to use case | Same normalization |

**Accidental new routes:** none.

## Provider coverage (reused adapters)

Registered via existing `registerMarketplaceWebhookAdapters` (same as `create-application.js`):

| Marketplace key | Adapter |
|-----------------|---------|
| `amazon` | `AmazonWebhookAdapter` |
| `namshi` | `NamshiWebhookAdapter` |
| `noon` | `NoonWebhookAdapter` |
| `shopify` | `ShopifyMarketplaceWebhookAdapter` (when runtime deps supplied) |

No new providers or topics were added in this phase.

## Signature verification & raw body

- **Express:** `marketplaceWebhookRawBodyMiddleware` in `src/nest/bootstrap/configure-express.js` (Phase 2) captures UTF-8 raw bytes before JSON parsing on webhook paths.
- **Nest controller:** reads `request.marketplaceWebhookRawBody` (not `JSON.stringify(req.body)`).
- **Verification:** delegated to existing marketplace webhook adapters (e.g. Shopify `X-Shopify-Hmac-Sha256` over raw body).

Flow preserved: **raw body → adapter authenticate → normalize → idempotency → lifecycle enqueue**.

## Ingress token resolution

Unchanged `ResolveMarketplaceWebhookConnection` + `webhook-ingress-token.js` hashing, wired through `createMarketplaceWebhookIngestionModule` via `wireMarketplaceWebhookIngestion`.

## Idempotency

`PostgresIdempotencyService` instantiated in `createNestInfrastructure` and passed into `ReceiveMarketplaceWebhook` (same as Fastify `create-application.js`).

## Lifecycle processing

`MarketplaceLifecycleEnqueueService` enqueues BullMQ jobs; worker-side `MarketplaceOrderLifecycleProcessor` / lifecycle services are **not** duplicated in Nest—only the HTTP ingress and module wiring moved.

## Nest architecture

```text
WebhooksModule → WebhooksController → WebhooksService → coreDomain.marketplaceWebhookIngestion.receiveMarketplaceWebhook
```

Bootstrap:

- `wire-marketplace-webhook-ingestion.js` — mirrors Fastify marketplace webhook module factory
- `wire-core-domain.js` — exposes `marketplaceWebhookIngestion` on `CORE_DOMAIN`
- `create-nest-infrastructure.js` — `idempotency`, `queue`, `queueConnection`
- `app.module.js` — registers `WebhooksModule`

## Files created / changed

**Created**

- `src/nest/webhooks/webhooks.module.js`
- `src/nest/webhooks/webhooks.controller.js`
- `src/nest/webhooks/webhooks.service.js`
- `src/nest/bootstrap/wire-marketplace-webhook-ingestion.js`
- `test/nest/marketplace-webhooks.test.js`
- `docs/migration-phase-8-marketplace-webhooks.md`

**Changed**

- `src/nest/app.module.js`
- `src/nest/bootstrap/create-nest-infrastructure.js`
- `src/nest/bootstrap/wire-core-domain.js`
- `src/nest/main.js` (infra deps + graceful `queue.close()` on shutdown)
- `test/nest/helpers/mock-core-domain.js`

**Unchanged (intentionally)**

- Fastify `marketplace-webhook.routes.js` and `create-application.js` webhook registration

## Tests executed

| Suite | Command | Result |
|-------|---------|--------|
| Jest (Nest) | `npm run test:jest` | **PASS** — 7 suites, 40 tests |
| Vitest (unit) | `npm run test:unit` | **PASS** — 136 files, 623 tests |
| Syntax | `npm run build` | **PASS** — 1046 JS files |

### Nest webhook tests (`test/nest/marketplace-webhooks.test.js`)

- Public route (no bearer)
- Success envelope and `replayed` flag
- Raw body and lower-cased headers forwarded to use case
- Ingress token validation (400)
- Authentication error → 401
- Idempotency replay response shape
- Adapter registration keys (amazon, namshi, noon, shopify)

Deeper signature/idempotency/lifecycle behavior remains covered by existing Vitest suites under `tests/unit/marketplace-webhook-ingestion/` and provider adapter tests.

## Startup verification

```text
NestJS startup: NOT VERIFIED — full bootstrap requires PostgreSQL, Redis (queue), and migrations; not run in this environment.
Fastify startup: NOT VERIFIED — same infrastructure dependency.
```

## Known limitations

- Phase 8 branch is stacked on Phase 6–7 Nest work (`migration/nest-express-phase-7` base) until PRs **#83** / **#84** merge into `dev`.
- End-to-end webhook delivery against real Shopify/Amazon/Noon/Namshi was **not** run (no live connections in CI/local).
- Integration test `tests/integration/marketplace-webhook-ingestion.test.js` was **not** re-run here (requires Postgres); unit/Jest coverage used instead.

## Dependencies

- PostgreSQL (connections, idempotency)
- Redis (BullMQ for lifecycle enqueue)
- Existing encrypted marketplace connection secrets (Shopify HMAC, etc.)
