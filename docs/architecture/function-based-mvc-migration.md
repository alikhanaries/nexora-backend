# Function-Based MVC Migration — Audit and Plan

**Status:** Stage 0 complete (audit + baselines). Stage 1 in progress (config facade, composition patterns, pilot use case).  
**Branch:** `fix/final-nest-runtime-validation`  
**Constraint:** Structural refactor only — no business-rule, API, or persisted-identifier changes.

## Executive summary

Wasl is a **modular monolith** (domain / application / infrastructure / presentation per module) with a **NestJS + Express** HTTP surface (`src/nest/`). Module **composition roots are already function-based** (`createOrdersModule`, `createWebhooksModule`, …). Most **use cases are class + `execute()`** (~375 `export class` hits under `src/modules/`). **Configuration is centralized** in `src/app/config/` and `src/shared/config/wasl-naming.config.js`. **`process.env` is not read in business modules.**

A full folder restructure to the target MVC tree in one pass would touch **1,000+ files** and cannot be validated safely without phased delivery. This document is the authoritative migration plan.

## Current architecture (as-is)

```text
src/
  app/                    Bootstrap, validated config, legacy Fastify entry (main.js)
  nest/                   Active NestJS controllers/modules (class-based — framework)
  modules/<feature>/      domain | application | infrastructure | presentation | public | index.js
  infrastructure/         Postgres, Redis, BullMQ, HTTP, observability
  workers/                Job handlers + bootstrap wiring
  shared/                 Cross-cutting ports, errors, events, metrics (leaf layer)
  integrations/           StockConnect mappers (compatibility)
```

**NestJS (framework-mandated classes):** ~34 controller files under `src/nest/`, plus `@Module` / `@Injectable` providers. These remain thin delegates to module `useCases` / services created by `create*Module` factories.

**Legacy / duplicate paths on disk (do not expand):** Some IDE indexes still list removed `channels/`, `channel-catalog-sync/` trees; authoritative modules are `commerce-integrations/` and `integration-catalog-sync/`.

## Target architecture (guideline)

### Orders module — **implemented (Phase 4.6)**

Physical MVC under `src/modules/orders/`:

```text
orders/
  index.js                 # createOrdersModule
  models/                  # domain entities & rules
  services/                # use cases (createGetOrder, CreateOrder, …)
  repositories/            # PostgresOrderRepository + ports
  views/                   # order.mapper.js, order.schemas.js, order-dto.js
  controllers/             # legacy Fastify order.routes.js
  controllers/nest/        # NestJS OrdersModule / Controller / Service
  public/                  # cross-module contracts
```

Nest bootstrap imports `OrdersModule` from `src/modules/orders/controllers/nest/orders.module.js`. Other features still use `src/nest/<feature>/` until migrated.

Enforced by: `tests/unit/architecture/orders-mvc-structure.test.js` and dependency-cruiser rules (`services-no-controllers`, `views-no-repositories`, …).

### Cancellations module — **implemented (Phase 4.7)**

Same MVC layout under `src/modules/cancellations/` (`models`, `services`, `repositories`, `views`, `controllers`, `controllers/nest`, `public`, `index.js`). Nest imports `CancellationsModule` from `src/modules/cancellations/controllers/nest/cancellations.module.js`.

Enforced by: `tests/unit/architecture/cancellations-mvc-structure.test.js`.

### Shipments module — **implemented (Phase 4.8)**

Same MVC layout under `src/modules/shipments/`. Nest imports `ShipmentsModule` from `public/nest-shipments-module.js`.

Enforced by: `tests/unit/architecture/shipments-mvc-structure.test.js`.

### Returns module — **implemented (Phase 4.9)**

Same MVC layout under `src/modules/returns/`. Nest imports `ReturnsModule` from `public/nest-returns-module.js`.

Enforced by: `tests/unit/architecture/returns-mvc-structure.test.js`.

### Remaining modules (not yet physically migrated)

| Target | Current authoritative location |
|--------|--------------------------------|
| `src/config/` | **Stage 1 facade** → `src/app/config/`, `src/shared/config/wasl-naming.config.js` |
| `src/common/` | **`src/shared/`** (errors, validation, http, security, logging) — alias documented in `src/common/README.md` |
| `modules/*/controllers/` | **`src/nest/<feature>/`** + optional `presentation/*.routes.js` |
| `modules/*/services/` | **`modules/*/application/`** |
| `modules/*/repositories/` | **`modules/*/infrastructure/postgres-*-repository.js`** |
| `modules/*/models/` | **`modules/*/domain/`** |
| `modules/*/views/` | **`modules/*/presentation/*mapper*`**, DTO helpers in application |
| `integrations/marketplace/` | **`modules/marketplaces/infrastructure/adapters/`** |
| `database/` | **`src/infrastructure/postgres/`** + migrations |

## Configuration (centralized today)

| Concern | File |
|---------|------|
| Env parse + Zod schema | `src/app/config/schema.js` |
| Typed `loadConfig` | `src/app/config/config.js` |
| Public entry | `src/app/config/index.js`, **Stage 1:** `src/config/index.js` |
| Naming + external compatibility registry | `src/shared/config/wasl-naming.config.js` |
| Queue logical names | `WASL_NAMING` → `src/infrastructure/queue/queue-names.js` |

**Secrets:** Tenant marketplace credentials stay **encrypted per connection** (`AUTH_MFA_ENCRYPTION_KEY` + `AesSecretEncryptor`). Optional deployment defaults: `NOON_API_BASE_URL`, `NOON_USER_AGENT` (see schema.js).

## Duplication and generic extraction (candidates — not yet merged)

| Area | Notes |
|------|--------|
| Marketplace JWT (Noon/Namshi) | Similar RS256 login; merge only after semantic diff |
| Catalog adapters | Shared base classes; convert to shared **functions** incrementally per adapter family |
| Compat v2 vs StockConnect CE mappers | Intentionally separate external contracts |
| `channel-catalog-sync` vs `integration-catalog-sync` | **Remove stale tree** after import audit (Phase B) |

Do not extract until two implementations are proven semantically identical.

## Function-based pattern (canonical)

**Module boundary (existing):**

```javascript
export function createOrdersModule(deps) {
  const getOrder = createGetOrder({ authorization, queryable, orders });
  return { useCases: { getOrder, /* … */ } };
}
```

**Use cases (Orders):** `createGetOrder`, `createListOrders`, `createOrderQueryService` in `modules/orders/services/` (see `modules/orders/services/README.md`).

**Use case (target — pilot: `get-order.js`):**

```javascript
export function createGetOrder(deps) {
  async function execute(input) { /* unchanged workflow */ }
  return { execute };
}
```

**Nest controller (unchanged role):** class maps HTTP → `useCases.*.execute()`.

## Phased migration

| Phase | Scope | Risk |
|-------|--------|------|
| **0** | Audit, baselines, this document | None |
| **1** | Config facade (`src/config/`), `src/common/README`, composition architecture test, **one pilot use case** (`createGetOrder`) | Low |
| **2** | Orders module: convert remaining use cases to factories; keep `createOrdersModule` API stable | Medium |
| **3** | Commerce integrations, marketplaces connections (credential paths unchanged) | Medium |
| **4** | Integration-catalog-sync, workers handlers (function handlers already) | Medium |
| **5** | Nest controllers: optional thin functional wrappers — only if Nest version supports | Low–medium |
| **6** | Remove obsolete classes/files; delete ghost `channels/` paths | High — needs full test matrix |

After each phase: `verify:naming`, `test:unit`, `test:jest`, `arch:check`, `build`, targeted integration.

## NestJS wrappers that must remain (documented)

| Wrapper | Why |
|---------|-----|
| `@Module`, `@Controller`, `@Injectable` | Nest DI and route registration |
| `src/nest/bootstrap/create-nest-application.js` | Express adapter bootstrap |
| Guards / filters (class) | Nest request pipeline |

Business logic must not live in controllers; controllers call module use cases.

## Baselines (Phase 0)

Recorded at migration kickoff:

- `verify:naming`: OK (~1217 files)
- `build`: OK (~1057 JS files)
- `test:unit`: 144 files / 636 tests pass
- `arch:check`: 0 errors, 72 warnings (orphans)
- `lint`: 0 errors (after Phase 4.2)

## Acceptance tracking

| Criterion | State |
|-----------|--------|
| Feature-based layout | **Partial** — modules exist; MVC subfolders not forced |
| Function-based business logic | **Partial** — composition functions yes; use cases mostly classes |
| Single config layer | **Mostly** — Stage 1 facade added |
| Generic shared behavior | **Partial** — `shared/` exists; dedup backlog above |
| Behavior preserved | **Required** — enforced per phase |

## Related ADRs

Historical module layout: `src/modules/README.md`, ADR-001 modular monolith. Naming: `wasl-naming.config.js` + `verify:naming`.
