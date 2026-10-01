# Nexora NestJS Migration — Final Validation & Cutover Readiness

**Validation date:** 2026-10-01 (static + automated); **runtime follow-up:** 2026-10-01  
**Reference `dev` commit:** `facd09d` (includes Phase 12 `#89` and validation doc `#90`)  
**PR #89 (Phase 12):** **MERGED** into `dev` (`18c925a`)  
**PR #90 (validation doc):** **MERGED** into `dev`

---

## Migration summary

| Item | Status |
|------|--------|
| Planned migration phases | **12 / 12** (feature migration complete) |
| Nest stack | NestJS 11 + Express adapter, **JavaScript only** |
| Fastify | Still registered on main app entry (`src/app/main.js`); **not removed** |
| Phase 12 on `dev` | **YES** — commit `18c925a` on `dev` |

### Phase documentation map

| Phase | Focus | Doc |
|-------|--------|-----|
| 2 | Nest + Express foundation | `migration-phase-2-nest-express.md` |
| 3 | Infrastructure wiring | `migration-phase-3-infrastructure.md` |
| 4 | Core modules | `migration-phase-4-core-modules.md` |
| 5 | Feature modules | `migration-phase-5-feature-modules.md` |
| 6 | Products, pricing, offers, inventory | `migration-phase-6-products-pricing-offers-inventory.md` |
| 7 | Channels, marketplaces | `migration-phase-7-channels-marketplaces.md` |
| 8 | Inbound marketplace webhooks | `migration-phase-8-marketplace-webhooks.md` |
| 9 | Core `/api/v1/orders` | `migration-phase-9-orders.md` |
| 10 | Cancellations, shipments, returns (v1) | `migration-phase-10-order-adjacent-apis.md` |
| 11 | Legacy orders + CE orders (v2) | `migration-phase-11-legacy-order-apis.md` |
| 12 | Remaining compatibility (v2 / CE) | `migration-phase-12-remaining-compatibility-apis.md` |

---

## Phase A — Merge verification

- **PR #89:** **MERGED** (2026-10-01).
- **`dev` updated:** `git pull origin dev` — Phase 12 Nest controllers present.
- **Phase 12 present:** **YES** — branch `dev`, commit `18c925a` in history.

---

## Phase B — Route inventory (static parity)

**Method:** `scripts/compare-nest-fastify-routes.mjs` scans Fastify `*.routes.js` + `create-server.js` vs Nest `*.controller.js`.

| Metric | Count |
|--------|------:|
| **Fastify** unique main-server routes | **147** |
| **NestJS** controller routes | **133** |
| **Matched (both)** | **133** |
| **Fastify-only** | **14** |
| **Nest-only (unexpected)** | **0** |

Every Nest route has a Fastify counterpart. No unexplained Nest-only HTTP routes.

### Fastify-only routes (14) — explained

| Method | Path | Category | Nest status | Notes |
|--------|------|----------|-------------|-------|
| POST | `/api/v1/webhooks` | Outbound tenant webhooks | **Not migrated** | Explicitly deferred in Phases 8–12 |
| GET | `/api/v1/webhooks` | Outbound tenant webhooks | **Not migrated** | |
| GET | `/api/v1/webhooks/:webhookId` | Outbound tenant webhooks | **Not migrated** | |
| PATCH | `/api/v1/webhooks/:webhookId` | Outbound tenant webhooks | **Not migrated** | |
| DELETE | `/api/v1/webhooks/:webhookId` | Outbound tenant webhooks | **Not migrated** | |
| POST | `/api/v1/webhooks/:webhookId/rotate-secret` | Outbound tenant webhooks | **Not migrated** | |
| GET | `/api/v1/webhooks/:webhookId/deliveries` | Outbound tenant webhooks | **Not migrated** | |
| GET | `/api/v1/webhooks/:webhookId/deliveries/:deliveryId` | Outbound tenant webhooks | **Not migrated** | |
| GET | `/api/v1/foundation/ping` | Foundation (v1) | **Not migrated** | Nest has `/health/*`; v1 ping remains Fastify |
| POST | `/api/v1/foundation/echo` | Foundation (v1) | **Not migrated** | |
| GET | `/openapi.json` | Docs / OpenAPI | **Not migrated** | Fastify `@fastify/swagger` + Scalar |
| GET | `/api-docs.json` | Docs / OpenAPI | **Not migrated** | |
| GET | `/api-docs` | Docs redirect | **Not migrated** | |
| GET | `/internal/metrics` | Observability | **Not migrated** | Prometheus on Fastify main server |

**Worker process** (`worker-observability.routes.js`) health/metrics are **out of scope** for HTTP API parity (separate listener).

### Migrated surface (133 routes) — by family

| Family | Routes on Nest | Parity vs Fastify |
|--------|---------------:|-------------------|
| Health | 2 | PASS |
| Auth / MFA / tenants / audit / API keys / authorization | 25 | PASS |
| Products, pricing, offers, inventory | 26 | PASS |
| Channels, marketplaces | 13 | PASS |
| Orders, cancellations, shipments, returns (v1) | 27 | PASS |
| Inbound marketplace webhooks | 1 | PASS |
| Compatibility `/api/v2/*` | 24 | PASS (on Phase 12 branch) |
| Compatibility `/api/v2/ce/*` | 20 | PASS (on Phase 12 branch) |

*(v2 counts include Phase 11 + 12 on Phase 12 branch.)*

---

## Phase C — Controller & business logic audit (static)

**Finding:** Nest controllers follow `Module → Controller → Service → existing use cases / routeDeps`. No new CQRS/DDD layers were introduced in migration phases.

| Area | Nest delegation | Parity assessment |
|------|-----------------|-------------------|
| `/api/v1/*` domain APIs | `coreDomain.*.useCases` / command services | **PASS** (static — same use cases as Fastify route handlers) |
| `/api/v2/*` + `/api/v2/ce/*` | `coreDomain.compatibility.routeDeps` | **PASS** on Phase 12 branch |
| Marketplace webhook ingress | `marketplaceWebhookIngestion.receiveMarketplaceWebhook` | **PASS** |
| Raw body / HMAC | Express middleware in `configure-express.js` | **PASS** (Jest foundation tests) |

**NOT VERIFIED at runtime:** side-by-side Fastify vs Nest response diff for every endpoint.

---

## Phase D — Authentication & authorization

| Check | Result |
|-------|--------|
| Global Nest `AuthGuard` mirrors Fastify `authentication.plugin.js` public patterns | **PASS** (code review) |
| CE query `apiKey` / `X-CE-KEY` on `/api/v2/ce/*` | **PASS** (Phase 12 `auth.guard.js`) |
| Permission checks in use cases / compatibility commands | **PASS** (unchanged business layer) |
| Live unauthenticated / wrong-tenant matrix vs Fastify | **NOT VERIFIED** (Postgres unavailable) |

---

## Phase E — Validation & error contracts

| Surface | Nest handling | Result |
|---------|---------------|--------|
| `/api/v1/*` | `GlobalExceptionFilter` + shared errors | **PASS** (Jest module tests) |
| `/api/v2/*`, `/api/v2/ce/*` | `CompatibilityExceptionFilter` + `mapCoreErrorToExternalApiResponse` | **PASS** (Jest legacy/compatibility tests) |
| Marketplace webhooks | Existing ingestion + adapters | **NOT VERIFIED** live (no Nest server) |

---

## Phase F — Idempotency

| Surface | Implementation | Result |
|---------|----------------|--------|
| v1 mutations (orders, adjacent) | Existing idempotency services on use cases | **PASS** (static + Phase 9–10 Jest) |
| v2 mutations | `requireIdempotencyKey` + command idempotency | **PASS** (Jest samples) |
| CE mutations | `resolveStockConnectCeIdempotencyKey` when header omitted | **PASS** (Jest Phase 11–12) |
| DB-backed duplicate replay | — | **NOT VERIFIED** (Postgres down) |

---

## Phase G — Rate limits

Compatibility routes call `enforceCompatibilityRateLimit` with `COMPATIBILITY_RATE_LIMIT_POLICIES` (same as Fastify).  
**NOT VERIFIED:** live 429 responses and `retry-after` headers.

---

## Phase H — Webhook audit

| Integration | Inbound on Nest | Notes |
|-------------|-----------------|-------|
| Generic marketplace ingress | **Yes** — `POST /api/v1/inbound/marketplace-webhooks/:ingressToken` | Raw body middleware preserved |
| Shopify / Amazon / Noon / Namshi | Via existing adapters in ingestion module | **NOT VERIFIED** live |
| Outbound tenant webhooks | **Fastify only** (8 routes) | Blocks full HTTP parity |

---

## Phase I — Runtime smoke testing

### Environment check (follow-up run on `dev`)

| Check | Result | Detail |
|-------|--------|--------|
| PostgreSQL (`DATABASE_URL`) | **FAIL** | `ECONNREFUSED` — nothing listening (expected local port **5433** per `.env.example`) |
| Docker Compose (project `docker-compose.yml`) | **FAIL** | Docker Desktop daemon not running — could not start `postgres` service |
| Redis (`REDIS_URL`) | **PASS** | `PING` OK |

**Runtime validation blocked:**

```text
PostgreSQL is unavailable.
```

Do not treat NestJS runtime as validated until Postgres is reachable and smoke tests complete.

### NestJS startup

| Check | Result |
|-------|--------|
| `npm run dev:nest` / `start:nest` | **FAIL** — `AggregateError [ECONNREFUSED]` during migrations in `createNestInfrastructure` |
| Listen port | **NOT REACHED** |
| Queue initialization | **NOT VERIFIED** (startup aborted) |
| Graceful shutdown | **NOT VERIFIED** |

### Live HTTP smoke tests (Steps 6–12)

All **NOT EXECUTED** — Nest did not start. No live Fastify vs Nest comparison was performed.

| API family | Live smoke | Notes |
|------------|------------|-------|
| Authentication | **NOT EXECUTED** | |
| Products | **NOT EXECUTED** | |
| Inventory | **NOT EXECUTED** | |
| Pricing | **NOT EXECUTED** | |
| Offers | **NOT EXECUTED** | |
| Channels / marketplaces | **NOT EXECUTED** | |
| Orders | **NOT EXECUTED** | |
| Cancellations | **NOT EXECUTED** | |
| Shipments | **NOT EXECUTED** | |
| Returns | **NOT EXECUTED** | |
| `/api/v2/*` compatibility | **NOT EXECUTED** | |
| `/api/v2/ce/*` compatibility | **NOT EXECUTED** | |
| Marketplace webhooks (inbound) | **NOT EXECUTED** | |
| Authorization / tenant isolation (live) | **NOT EXECUTED** | |
| Idempotency (DB-backed, live) | **NOT EXECUTED** | |
| Error contracts (live invalid requests) | **NOT EXECUTED** | |
| Fastify side-by-side live diff | **NOT EXECUTED** | |

**Operational note to unblock:** start dependencies (`docker compose up -d postgres redis` or equivalent), confirm `DATABASE_URL`, run migrations if needed, then re-run this checklist.

---

## Phase J — Automated tests (executed on `dev` @ `facd09d`)

| Suite | Command | Result |
|-------|---------|--------|
| Jest | `npm run test:jest` | **PASS** — 11 suites, **83** tests |
| Vitest | `npm run test:unit` | **PASS** — 136 files, **623** tests |
| Build | `npm run build` | **PASS** — 1046 JS files |

---

## Phase K — Parity classification summary

| Classification | Count | Meaning |
|----------------|------:|---------|
| **PASS** | 133 | Route exists on both stacks (static) |
| **FASTIFY_ONLY** | 14 | Documented gaps (webhooks, docs, metrics, v1 foundation) |
| **NOT VERIFIED** | 133+ | Runtime behavior not compared live |

---

## Phase L — Legacy Fastify assessment

| Question | Answer |
|----------|--------|
| All **business** API routes on Nest? | **No** — 8 outbound webhook routes + observability/docs/foundation v1 helpers remain Fastify-only |
| Inbound webhooks on Nest? | **Yes** |
| Background workers | **Unchanged** — still separate Fastify/worker bootstrap (not part of Nest cutover scope) |
| Keep Fastify? | **Yes** — until Postgres runtime parity proven and optional webhook/docs parity decided |

---

## Phase M — Production cutover readiness checklist

```text
[x] All *in-scope* migration routes implemented on Nest (133/147 main-server HTTP)
[ ] All 147 Fastify main-server routes on Nest (14 documented exceptions)
[x] Route parity verified (static scan)
[ ] Auth parity verified (runtime)
[ ] Authorization parity verified (runtime)
[ ] Validation parity verified (runtime)
[ ] Error contract verified (runtime)
[ ] Idempotency verified (DB/runtime)
[ ] Rate limits verified (runtime)
[ ] Webhooks verified (live providers)
[ ] Database verified (Nest startup)
[x] Redis reachable on validation host
[ ] Queue verified on Nest
[x] Build verified
[x] Jest verified
[x] Vitest verified
[ ] Runtime smoke tests verified
[ ] Graceful shutdown verified
[x] No unexplained Nest-only routes
[x] Fastify fallback still available
[x] Phase 12 merged to dev
```

---

## Remaining risks

1. **No Postgres runtime proof** — Nest bootstrap, migrations, idempotency persistence, and all live smoke tests remain unproven on this host.
2. **14 Fastify-only HTTP routes** — outbound webhooks; docs/metrics/foundation v1 (intentional, not migration defects).
3. **Dual stack** — Fastify and Nest can diverge if only one is updated post-migration.
4. **Cutover without live parity** — Jest/Vitest alone are insufficient for production switch.

---

## Cutover recommendation (evidence-based)

**NOT READY FOR CUTOVER**

Concrete blockers:

1. **PostgreSQL unavailable** on validation host — start Postgres (e.g. project `docker compose up -d postgres`) and confirm connectivity.
2. **NestJS startup not completed** — blocked by (1).
3. **Live smoke tests not executed** — all API families, v2/CE, webhooks, authz, idempotency, shutdown.
4. **Fastify vs Nest live comparison not executed.**

Non-blocking (documented policy, not defects):

- **14 intentional Fastify-only routes** (outbound webhooks, v1 foundation, OpenAPI/docs, `/internal/metrics`).

Fastify must remain primary until runtime items **1–4** are **PASS**.

### When runtime passes — suggested operational cutover steps

1. Deploy Nest alongside Fastify (same DB/Redis), smoke-test in staging with real tokens.
2. Route new internal/staging traffic to Nest; compare metrics and error rates to Fastify.
3. Shift production ingress gradually; keep Fastify rollback path until burn-in completes.
4. Retain Fastify for the 14 routes until explicitly migrated or proxied.

---

## Tooling added in this validation

- `scripts/compare-nest-fastify-routes.mjs` — regenerates JSON parity summary (stdout).

```bash
node scripts/compare-nest-fastify-routes.mjs
```
