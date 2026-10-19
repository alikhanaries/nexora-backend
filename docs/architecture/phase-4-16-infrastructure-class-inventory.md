# Phase 4.16 — Infrastructure Class Inventory and Factory Migration Plan

**Status:** Historical inventory (Phase 4.16). P1 pilots completed in **4.17** (`RedisKeyBuilder`) and **4.18** (`Argon2PasswordHasher`). Post-migration next-step audit: [phase-4-19-infrastructure-post-migration-audit.md](./phase-4-19-infrastructure-post-migration-audit.md).  
**Date:** 2026-10-19  
**Prerequisite:** Phases 4.12–4.15 (Orders, Cancellations, Shipments, Returns business services → factories)  
**Runtime constraint:** NestJS + Express unchanged  

Related: [function-based-mvc-migration.md](./function-based-mvc-migration.md), [module-boundaries.md](./module-boundaries.md).

---

## 1. Preflight summary

| Item | Observation |
|------|-------------|
| Prior business-service factories | Orders / Cancellations / Shipments / Returns `services/` use `create*` factories; Nest adapters remain classes |
| Composition | `createInfrastructure` / `createApplication` / `create*Module` remain function-based composition roots |
| Working tree | Inventory produced without resetting or converting infrastructure |
| Approx. `export class` under `src/` | **~343** |

### Baseline checks (context from Phases 4.12–4.15; not re-asserted as green)

- Build / `verify:naming` / `arch:check` (0 errors) were green after Returns factories.
- Known unrelated: marketplace-worker unit failures (`commerceIntegrationQueryService`); repo-wide lint `process` errors; Jest/integration DB noise.

---

## 2. Totals and exclusions

### 2.1 Inspected / counted

| Bucket | Approx. count | Role in this audit |
|--------|---------------|--------------------|
| All `export class` in `src/` | ~343 | Universe |
| Nest decorator files (`@Controller` / `@Injectable` / `@Module` / …) | ~81 files | **Excluded** as Nest framework — keep classes |
| `Error` / `AppError` subclasses | ~30 | **Excluded** — keep classes |
| Deprecated compatibility wrappers (`constructor(deps) { return create*(deps); }`) | ~44 | **Excluded** — keep until consumers migrate |
| Domain `models/` entity classes | ~35 | **Not infrastructure** — keep (identity / invariants); separate from factory work |
| Remaining module `services/` use-case classes (identity, products, marketplaces, compatibility, webhooks, …) | large (~100+) | **Not infrastructure** — future business-service factory phases |
| `src/infrastructure/` classes | **23** (incl. 1 error) | **Primary inventory** |
| Module `Postgres*Repository` | **31** | **Primary inventory** (data adapters) |
| Marketplace / catalog / webhook adapters + registries | **~24** (non-error) | **Primary inventory** (integration adapters) |
| `src/shared/` classes | 18 (all errors) | Already under error exclusion |
| `src/app/` non-Nest classes | `ReadinessService` (+ Nest modules) | Documented below |
| `src/workers/` handler classes | 4 | Documented below |

### 2.2 Explicitly out of scope for infrastructure factory migration

1. Nest controllers, injectable Nest services, Nest modules, guards, filters, pipes.  
2. Error subclasses (`AppError` hierarchy, marketplace/catalog/webhook retry errors, `RetentionCleanupError`).  
3. Deprecated business-service wrappers from Phases 4.12–4.15.  
4. Domain entity classes under `models/` (`Order`, `Shipment`, `User`, …).  
5. Remaining **business** use-case classes outside O/C/S/R (continue as Phase 4.x business factory work, not infra).  

---

## 3. Infrastructure inventory (`src/infrastructure/`)

### 3.1 Resource owners / process lifecycle — **keep as class**

| File / symbol | Responsibility | Dependencies | State / lifecycle | Nest? | Factory suitability | Recommendation | Risk if converted |
|---|---|---|---|---|---|---|---|
| `postgres/postgres-database.js` → `PostgresDatabase` | Owns `pg` Pool(s); tenant transactions; metrics | config, logger, metrics | Mutable pool; `closed`; `close()` / health | No | **Unsuitable** | **Keep class** | Pool identity, shutdown races, RLS session semantics |
| `redis/redis-client.js` → `RedisConnection` | Owns ioredis client | config, logger, metrics | Mutable client; connect/close | No | **Unsuitable** | **Keep class** | Connection ownership / reconnect |
| `queue/bullmq-job-queue.js` → `BullMqJobQueue` | Owns BullMQ queues + dedicated Redis | Redis conn, config, logger, metrics | `queues` Map; `closed` | No | **Unsuitable** | **Keep class** | Queue handles; close ordering |
| `queue/bullmq-worker-runtime.js` → `BullMqWorkerRuntime` | Owns BullMQ workers | Redis, handlers, config | Worker set; start/stop | No | **Unsuitable** | **Keep class** | Worker lifecycle |
| `postgres/outbox-publisher.js` → `OutboxPublisher` | Polls outbox → enqueue | outbox repo, queue, config, logger | Timer; `running`/`stopped` | No | **Unsuitable** | **Keep class** | Interval ownership; at-least-once delivery |
| `postgres/inbox-consumer.js` → `InboxConsumer` | Inbox processing loop | inbox, handlers, config | Running state | No | **Unsuitable** | **Keep class** | Consumer loop |
| `postgres/retention-cleanup-scheduler.js` → `RetentionCleanupScheduler` | Schedules retention jobs | cleanup service, config | Timer | No | **Unsuitable** | **Keep class** | Scheduler ownership |
| `observability/prometheus-metrics.js` → `PrometheusMetrics` | Owns prom-client `Registry` + series | serviceName | Registry / counters / histograms | No | **Unsuitable** | **Keep class** | Global series identity; cardinality |

Consumers: `createInfrastructure` / workers / readiness probes; process shutdown via `gracefulShutdown`.

### 3.2 Postgres support adapters — **keep or investigate**

| File / symbol | Responsibility | State | Suitability | Recommendation | Notes |
|---|---|---|---|---|---|
| `postgres/outbox-repository.js` → `PostgresOutboxRepository` | Outbox persistence | Borrows queryable / uses DB | Candidate *or* keep | **Investigate** then likely **factory** | Same borrow-queryable pattern as module repos |
| `postgres/inbox-repository.js` → `PostgresInboxRepository` | Inbox persistence | Borrow queryable | Candidate | **Investigate** → factory slice | |
| `postgres/idempotency-service.js` → `PostgresIdempotencyService` | Idempotency execute/replay | Uses DB + keys | **Investigate** | Defer | Transaction + fingerprint semantics; high behavioral risk |
| `postgres/retention-cleanup-service.js` → `RetentionCleanupService` | Retention delete batches | Uses DB | Candidate (stateless ops) | **Investigate** | Paired with scheduler (keep scheduler class) |
| `postgres/webhook-delivery-retention.js` → `WebhookDeliveryRetention` | Webhook retention helper | Uses DB | Candidate | Low priority factory | |
| `postgres/retention-cleanup-service.js` → `RetentionCleanupError` | Error | — | N/A | **Keep class** | Error subclass |

### 3.3 Redis helpers — mixed

| File / symbol | Responsibility | State | Suitability | Recommendation |
|---|---|---|---|---|
| `redis/redis-keys.js` → `RedisKeyBuilder` | Deterministic key layout | Immutable `root` string | **Suitable** (stateless after construct) | **Migrated (Phase 4.17)** — `createRedisKeyBuilder`; deprecated class wrapper retained |
| `redis/redis-cache.js` → `RedisCache` | Cache get/set/del | Holds `RedisConnection` + keys | Soft candidate | **Investigate** — factory returning `{ get, set, … }` OK if connection injected |
| `redis/redis-distributed-lock.js` → `RedisDistributedLock` | Distributed locks | Holds connection | Soft candidate | **Investigate** — lock token semantics |
| `redis/redis-rate-limiter.js` → `RedisRateLimiter` | Rate limit evaluate | Holds connection + scripts | Soft candidate | **Investigate** — Lua/script load lifecycle |

### 3.4 Auth, HTTP, storage

| File / symbol | Responsibility | State | Suitability | Recommendation |
|---|---|---|---|---|
| `auth/argon2-password-hasher.js` → `Argon2PasswordHasher` | Hash/verify passwords | Stateless | **Suitable** | **Migrated (Phase 4.18)** — `createArgon2PasswordHasher`; deprecated class wrapper retained |
| `auth/aes-secret-encryptor.js` → `AesSecretEncryptor` | Encrypt/decrypt secrets | Holds key material | Soft candidate | **Investigate** — key must stay injected, never global |
| `auth/jose-access-token-service.js` → `JoseAccessTokenService` | JWT sign/verify | Holds keys/config | Soft candidate | **Investigate** |
| `http/fetch-http-client.js` → `FetchHttpClient` | Outbound HTTP + retries | Logger + timeout defaults | Soft candidate | **Migrated (Phase 4.21)** — `createFetchHttpClient`; deprecated class wrapper retained |
| `storage/s3-storage-provider.js` → `S3StorageProvider` | S3 put/get | Holds AWS client | Soft / keep | **Investigate** — SDK client identity |

---

## 4. Module repositories (Postgres)

### 4.1 Pattern (observed)

Representative: `PostgresOrderRepository` (and peers such as product/user repos):

- **No constructor dependencies** (or only trivial).
- Methods take **`queryable` / `transaction` as first argument** — they **borrow** connections from `PostgresDatabase`, they do **not** own the pool.
- Instantiated in `create*Module` as `new PostgresXRepository()` and passed into factories.

| Aspect | Finding |
|--------|---------|
| Connection ownership | **Borrow** — pool owned solely by `PostgresDatabase` |
| Transaction propagation | Caller supplies `tx` / `queryable` |
| Mutable instance state | Generally **none** (method-local only) |
| Nest lifecycle | **None** on repository classes |
| Public contract | Cross-module via `public/` ports / composition, not Nest tokens |

### 4.2 Inventory (all **31** `Postgres*Repository` under `src/modules/**/repositories/`)

Modules: audit, api-keys, authorization (role/permission/membership-role), cancellations, commerce-integrations, external-id-mapping, identity (user/membership/password/refresh/reset), inventory (+ stock-location), marketplaces (marketplace/connection/entity-mapping), mfa (factor/recovery/step-up), offers, orders, pricing, products (+ content), returns, shipments, tenants, webhooks outbound (subscription/delivery).

| Suitability | Recommendation |
|-------------|----------------|
| Strong **factory candidates** *in a later phase* | Convert to `createPostgresOrderRepository()` returning method bag **or** keep as class-as-namespace — either preserves borrow-queryable semantics |
| **Do not convert in Phase 4.16** | Explicitly out of scope |

**Risks if converted later:** JSDoc/`instanceof` assumptions; test doubles that `new` repositories; accidental capture of a closed DB if someone starts injecting pool into repo constructors (must not).

**Recommended stance:** Prefer **keep as class** for familiarity **or** convert in a dedicated “repository factory” slice only after a pilot (e.g. `PostgresAuditRepository`) proves zero behavioral drift. **Not** the same priority as resource-owner classes (those stay classes forever).

---

## 5. Integration adapters and registries

| Kind | Examples | Suitability | Recommendation |
|------|----------|-------------|----------------|
| Base adapter classes | `BaseMarketplaceOrderAdapter`, `BaseMarketplaceCatalogAdapter` | Inheritance | **Keep classes** |
| Marketplace adapters | Shopify/Noon/Amazon/Namshi order/catalog/webhook/outbound | Extend bases; often hold HTTP/runtime | **Keep classes** (or investigate per adapter) |
| Registries | `MarketplaceOrderAdapterRegistry`, webhook/catalog/outbound registries | Mutable registration maps | **Keep classes** or factory with mutable map — **investigate** |
| `MarketplaceAdapterRuntimeFactory` | Builds runtime for connections | Factory-shaped but class today | **Investigate** → likely rename/refactor to function without behavior change |
| `FoundationStubMarketplaceCatalogAdapter` | Stub | Low risk | Candidate / keep |

**Do not** fold adapters into business factories; keep marketplace boundary intact (ADR-029).

---

## 6. App / workers (non-Nest infrastructure-adjacent)

| File / symbol | Role | Recommendation |
|---|---|---|
| `app/observability/readiness.js` → `ReadinessService` | Mutable acceptingTraffic + probes | **Keep class** (or factory with closure state — low priority) |
| `app/common/nest-logger.service.js` → `NestLoggerService` | Nest logger bridge | **Keep class** (Nest) |
| `app/database/database.module.js`, `app/di/core-services.module.js` | Nest dynamic modules | **Keep class** (Nest) |
| `workers/handlers/*` (`CatalogSyncEnqueueHandler`, `WebhookDispatchEnqueueHandler`, `LoggingIntegrationEventHandler`, `CompositeIntegrationEventRouter`) | Worker routing | **Investigate** — often thin; could be factories; not Nest |

---

## 7. Architecture notes (no repairs in this phase)

| Check | Result |
|-------|--------|
| Business → infrastructure direct imports | Boundaries enforced by dependency-cruiser; no change proposed here |
| Cross-module private layers | Existing `no-cross-module-internals` (ERP exempt) |
| New DI framework / globals | **Not** recommended |
| Nest + Express | Unchanged |
| Violations found during audit | None newly introduced; orphan warnings (~75) pre-exist |

---

## 8. Prioritized future migration slices (approval required)

> **None of these start in Phase 4.16.**

| Priority | Slice | Scope | Suggested tests |
|----------|-------|-------|-----------------|
| **P0 — Never convert** | Process resource owners | `PostgresDatabase`, `RedisConnection`, `BullMqJobQueue`, `BullMqWorkerRuntime`, `OutboxPublisher`, `InboxConsumer`, `RetentionCleanupScheduler`, `PrometheusMetrics` | Lifecycle/shutdown/integration only; no factory rewrite |
| **P1 — Safe helper pilot** | Stateless crypto / keys | `RedisKeyBuilder` (**done in 4.17**), `Argon2PasswordHasher` (**done in 4.18**) | Unit: key format / hash verify; composition still injects instances |
| **P2 — Thin clients** | HTTP / JWT / AES / S3 | `FetchHttpClient` (**done in 4.21**), `JoseAccessTokenService`, `AesSecretEncryptor`, `S3StorageProvider` | Unit with mocked fetch/SDK; no env reads in modules |
| **P3 — Redis facades** | Cache / lock / rate limit | `RedisCache`, `RedisDistributedLock`, `RedisRateLimiter` | Unit against fake RedisConnection; concurrency lock tests |
| **P4 — Infra postgres helpers** | Outbox/inbox/retention/idempotency | Repos + `PostgresIdempotencyService` | Idempotency + outbox at-least-once integration |
| **P5 — Module repositories (pilot)** | One small repo first | e.g. `PostgresAuditRepository` → factory | Repository unit + one integration path |
| **P6 — Module repositories (rollout)** | Remaining 30 repos | Same borrow-queryable contract | Module integration matrices |
| **P7 — Worker handlers** | `src/workers/handlers/*` | Function handlers | Worker unit tests |
| **Defer — adapters** | Marketplace inheritance tree | Keep classes until adapter redesign | Adapter contract tests only |
| **Separate track** | Remaining **business** services | identity, products, inventory, marketplaces, compatibility, webhooks, catalog-sync, … | Same pattern as 4.12–4.15 — **not** infra |

---

## 9. Classification rollup (infrastructure focus)

### Keep as class (strong)

- All process resource owners (§3.1).  
- Nest-required app modules/logger.  
- Marketplace base adapters + most concrete adapters.  
- Error subclasses everywhere.  
- Domain `models/` entities.  

### Candidate for factory (later phases)

- ~~`RedisKeyBuilder`, `Argon2PasswordHasher`~~ — **done** (4.17 / 4.18); deprecated wrappers remain.  
- ~~`FetchHttpClient`~~ — **done in 4.21** (`createFetchHttpClient`); deprecated wrapper retained.  
- Later: `RedisCache`; module `Postgres*Repository` (borrow-queryable; pilot first).  
- Possible: Redis lock/rate-limiter facades; outbox/inbox repositories; worker handlers.  

### Needs further investigation / defer

- `AesSecretEncryptor`, `JoseAccessTokenService` (security-sensitive).  
- `PostgresIdempotencyService` (correctness-critical).  
- `MarketplaceAdapterRuntimeFactory` / registries.  
- Redis Lua/script initialization in rate limiter.  
- S3 client lifecycle (`S3StorageProvider` — prefer keep as class).  

---

## 10. Confirmation (Phase 4.16 deliverable constraint)

| Constraint | Status |
|------------|--------|
| No infrastructure class converted to a factory | **Confirmed for 4.16** (later: 4.17–4.18 converted P1 only) |
| No SQL / schema / migration changes | **Confirmed** |
| No business-logic changes (Orders/Cancellations/Shipments/Returns) | **Confirmed** |
| No API / public contract / `.env` changes | **Confirmed** |
| No Fastify / Nest runtime change | **Confirmed** |
| No commit / PR / deploy | **Confirmed** |

**Stop (historical):** 4.16 awaited approval before P1. **Current progress:** [phase-4-22-function-based-mvc-progress-audit.md](./phase-4-22-function-based-mvc-progress-audit.md) (after 4.17–4.21 infra pilots).
