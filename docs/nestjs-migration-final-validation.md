# Nexora NestJS Migration — Final Validation & Cutover Readiness

**Validation date:** 2026-10-01 (static + automated); **runtime follow-up:** 2026-10-01  
**Live runtime smoke (local):** 2026-10-01 — branch `fix/final-nest-runtime-validation`  
**Reference `dev` commit:** includes Phase 12 `#89` and validation doc `#90`  
**PR #89 (Phase 12):** **MERGED** into `dev` (`18c925a`)  
**PR #90 / #91:** validation documentation PRs (runtime updates via #91)

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

### Run A — blocked (earlier on `dev`)

| Check | Result |
|-------|--------|
| PostgreSQL via `.env` (`localhost:5433`) | **FAIL** — `ECONNREFUSED` |
| Docker Compose | **FAIL** — Docker Desktop daemon not running |
| Nest startup | **FAIL** — migrations could not connect |

### Run B — live validation (2026-10-01, local host)

**Infrastructure**

| Check | Result | Notes |
|-------|--------|-------|
| Docker Compose `postgres`/`redis` | **NOT USED** | Daemon unavailable |
| PostgreSQL | **PASS** | Local instance on **5432** (`nexora` database); session used `postgresql://nexora:nexora@localhost:5432/nexora` (matches `.env.example` credentials, not committed) |
| `.env` default `DATABASE_URL` port **5433** | **FAIL** | Compose Postgres not running — developers must start Docker **or** align URL with local Postgres |
| Redis | **PASS** | `PING` OK via configured `REDIS_URL` |
| Migrations | **PASS** | 47 migrations applied (schema up to date) |
| Dev seed | **PASS** | `scripts/seed-dev-user.mjs` — tenant `nexora-dev`, user `admin@nexora.dev` |

**Application**

| Check | Result | Notes |
|-------|--------|-------|
| NestJS startup | **PASS** | `node src/nest/bootstrap.mjs`, `NEST_SERVER_PORT=3010`, Postgres wired |
| Fastify startup (comparison) | **PASS** | `node src/app/main.js`, `SERVER_PORT=3000`, same DB session |
| Database connectivity (Nest) | **PASS** | `postgres: true` in startup log; authenticated reads succeeded |
| Queue initialization | **PASS** | Redis + BullMQ initialized during bootstrap (same as Fastify infra) |
| Graceful shutdown | **NOT VERIFIED** | Process stopped with `Stop-Process -Force`; SIGTERM shutdown path not recorded |

**Live smoke script:** `scripts/local-runtime-smoke.mjs`

```bash
# Example (after Nest on 3010, optional Fastify on 3000):
DATABASE_URL=postgresql://nexora:nexora@localhost:5432/nexora \
DATABASE_MIGRATION_URL=postgresql://nexora:nexora@localhost:5432/nexora \
NEST_SERVER_PORT=3010 node --env-file=.env src/nest/bootstrap.mjs

NEST_BASE_URL=http://127.0.0.1:3010 FASTIFY_BASE_URL=http://127.0.0.1:3000 \
node scripts/local-runtime-smoke.mjs
```

**Results:** **43 PASS**, **0 FAIL** (representative GET coverage + auth + v2 validation sample + 3 Fastify body comparisons).

| API family | Live smoke | Detail |
|------------|------------|--------|
| Authentication | **PASS** | Login 200; unauthenticated `/api/v1/products` → **401** |
| Products / pricing / offers / inventory | **PASS** | Authenticated GET list endpoints **200**, v1 `success` envelope |
| Channels / marketplaces | **PASS** | GET **200** |
| Orders / cancellations / shipments / returns | **PASS** | GET list **200** |
| `/api/v2/*` | **PASS** | `foundation/ping`, orders, shipments/merchant, cancellations/merchant, returns/merchant/new; missing SKU on `/api/v2/products` → **400** `Success: false` |
| `/api/v2/ce/*` | **PASS** | GET `/api/v2/ce/channels` **200** |
| Fastify vs Nest (sample) | **PASS** | `/api/v1/products`, `/api/v1/orders`, `/api/v2/foundation/ping` — status + JSON body match |
| Marketplace webhooks | **PARTIAL** | Invalid ingress token → **401** + `AUTHENTICATION_REQUIRED` (happy-path enqueue **NOT VERIFIED** — no test connection token in DB) |
| Authorization / tenant isolation | **NOT VERIFIED** | Owner user only; no cross-tenant matrix |
| Idempotency (live duplicate) | **NOT VERIFIED** | |
| Rate limits (live 429) | **NOT VERIFIED** | |
| CE query `apiKey` auth (live) | **NOT VERIFIED** | Bearer used in script |
| PDF / file responses (live) | **NOT VERIFIED** | |

---

## Phase J — Automated tests (latest run on validation branch)

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
| **NOT VERIFIED** | Partial | Representative live checks passed; full matrix not complete |

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
[ ] All 147 Fastify main-server routes on Nest (14 documented exceptions — intentional)
[x] Route parity verified (static scan)
[x] Auth parity verified (runtime — login + 401 sample)
[ ] Authorization parity verified (runtime — full permission/tenant matrix)
[x] Validation parity verified (runtime — sample: v2 products missing SKU)
[ ] Error contract verified (runtime — full 4xx matrix)
[ ] Idempotency verified (DB/runtime duplicate replay)
[ ] Rate limits verified (runtime)
[ ] Webhooks verified (live happy path / provider adapters)
[x] Database verified (Nest startup + live reads)
[x] Redis reachable on validation host
[x] Queue verified on Nest (startup initialization)
[x] Build verified
[x] Jest verified
[x] Vitest verified
[x] Runtime smoke tests verified (representative script — 43 checks)
[ ] Graceful shutdown verified
[x] No unexplained Nest-only routes
[x] Fastify fallback still available
[x] Phase 12 merged to dev
[x] Docker Compose default `.env` port 5433 path verified — NO (daemon down on validation host)
```

---

## Remaining risks

1. **Default local `.env` (port 5433) not validated** — Docker Compose Postgres was not running; runtime used Postgres on **5432** instead.
2. **14 Fastify-only HTTP routes** — outbound webhooks; docs/metrics/foundation v1 (intentional, not migration defects).
3. **Incomplete live matrix** — idempotency replay, rate limits, tenant isolation, webhook happy path, CE query auth, graceful shutdown, staging burn-in.
4. **Dual stack** — Fastify and Nest can diverge if only one is updated post-migration.

---

## Cutover recommendation (evidence-based)

**NOT READY FOR PRODUCTION CUTOVER**

Representative **local** runtime validation **passed** (Nest + Fastify side-by-side on migrated routes). Remaining blockers before switching production traffic:

1. Validate the **standard dependency path** for your environment (e.g. `docker compose up -d postgres redis` and `.env` `DATABASE_URL` on **5433**).
2. Run smoke script (or equivalent) in **staging** with production-like config and monitoring.
3. Complete **webhook happy-path** test with a real ingress token / sandbox provider fixture.
4. Verify **idempotency duplicate replay**, **tenant isolation**, and **graceful shutdown** under SIGTERM.
5. Operational plan for **14 Fastify-only** surfaces (keep Fastify sidecar or migrate later).

Non-blocking (documented policy, not defects):

- **14 intentional Fastify-only routes** (outbound webhooks, v1 foundation, OpenAPI/docs, `/internal/metrics`).

Fastify must remain available for rollback and Fastify-only routes until staging burn-in completes.

### When runtime passes — suggested operational cutover steps

1. Deploy Nest alongside Fastify (same DB/Redis), smoke-test in staging with real tokens.
2. Route new internal/staging traffic to Nest; compare metrics and error rates to Fastify.
3. Shift production ingress gradually; keep Fastify rollback path until burn-in completes.
4. Retain Fastify for the 14 routes until explicitly migrated or proxied.

---

## Tooling added in this validation

- `scripts/compare-nest-fastify-routes.mjs` — static Fastify vs Nest route parity (stdout JSON).
- `scripts/local-runtime-smoke.mjs` — live HTTP smoke + optional Fastify comparison.

```bash
node scripts/compare-nest-fastify-routes.mjs
NEST_BASE_URL=http://127.0.0.1:3010 FASTIFY_BASE_URL=http://127.0.0.1:3000 node scripts/local-runtime-smoke.mjs
```
