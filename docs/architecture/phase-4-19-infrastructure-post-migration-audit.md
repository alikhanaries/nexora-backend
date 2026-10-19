# Phase 4.19 — Post-Migration Infrastructure Audit and Next-Candidate Selection

**Status:** Audit / documentation only — **no runtime conversions**  
**Date:** 2026-10-19  
**Prerequisite:** Phases 4.16 (inventory), 4.17 (`RedisKeyBuilder`), 4.18 (`Argon2PasswordHasher`)  
**Runtime constraint:** NestJS + Express unchanged  

Related: [phase-4-16-infrastructure-class-inventory.md](./phase-4-16-infrastructure-class-inventory.md), [function-based-mvc-migration.md](./function-based-mvc-migration.md).

---

## 1. Verification of completed P1 migrations

Inspected against the current tree (not prior chat reports).

| Claim | Evidence | Result |
|-------|----------|--------|
| `createRedisKeyBuilder` is the active API | `src/infrastructure/redis/redis-keys.js` exports factory + deprecated `RedisKeyBuilder` wrapper | **Confirmed** |
| Composition uses the Redis key factory | `src/app/create-infrastructure.js`, `src/app/create-nest-infrastructure.js` call `createRedisKeyBuilder({ prefix, namespace })` | **Confirmed** |
| `createArgon2PasswordHasher` is the active API | `src/infrastructure/auth/argon2-password-hasher.js` exports factory + deprecated `Argon2PasswordHasher` wrapper | **Confirmed** |
| Identity composition uses the hasher factory | `src/modules/identity/index.js` → `createArgon2PasswordHasher()` | **Confirmed** |
| Compatibility wrappers retained | Both wrappers `return create*(…)` from constructors | **Confirmed** |
| Characterization unit tests present | `tests/unit/infrastructure/redis-keys.test.js`, `argon2-password-hasher.test.js` | **Confirmed** |
| Roadmap mentions 4.17 / 4.18 | `function-based-mvc-migration.md` phase table | **Confirmed** |
| Phase 4.16 inventory marks P1 done | Rows for Redis keys + Argon2; P1 slice note | **Confirmed** (see §6 for remaining doc drift) |

**Ghost paths:** Index/search may still mention deleted `src/app/bootstrap/create-infrastructure.js` or `src/nest/bootstrap/create-nest-infrastructure.js` with `new RedisKeyBuilder`. Those paths are **not present on disk**. Active composition roots are under `src/app/create-*.js` only.

**Security / key contracts (spot-check):** Argon2 still uses `{ type: argon2.argon2id }` only; Redis key layout comment and factory logic unchanged in structure from 4.17.

---

## 2. Remaining `src/infrastructure/` classes (current)

| Count | Notes |
|-------|--------|
| **23** `export class` symbols | Includes 2 deprecated wrappers (`RedisKeyBuilder`, `Argon2PasswordHasher`) and 1 error (`RetentionCleanupError`) |
| **21** active infrastructure classes | After excluding the two wrappers |
| Already functions | `createPinoLogger`, `startTracing`, migrator helpers, `createQueueRedisConnection`, `computeRetentionCutoff`, postgres error helpers |

### 2.1 Keep as class (resource / lifecycle / registry identity)

| Symbol | Why |
|--------|-----|
| `PostgresDatabase`, `RedisConnection` | Own pool / client; connect/close |
| `BullMqJobQueue`, `BullMqWorkerRuntime` | Own queue/worker handles |
| `OutboxPublisher`, `InboxConsumer`, `RetentionCleanupScheduler` | Timers / loop ownership |
| `PrometheusMetrics` | Owns prom-client registry series |
| `S3StorageProvider` | Owns `S3Client`; mutable `bucketEnsured` |
| `RetentionCleanupError` | Error subclass |

### 2.2 Defer (security, concurrency, or high behavioral risk)

| Symbol | Why defer |
|--------|-----------|
| `AesSecretEncryptor` | Holds encryption key material; ciphertext format compatibility |
| `JoseAccessTokenService` | Auth tokens; already has `static create`; HS/RS key paths |
| `RedisDistributedLock` | Token/TTL/compare-and-delete concurrency |
| `RedisRateLimiter` | Lua/GCRA semantics; auth/compat rate paths |
| `PostgresIdempotencyService` | Fingerprint + transaction replay correctness |
| `RetentionCleanupService`, `WebhookDeliveryRetention` | Destructive SQL retention; tenant batching |
| Marketplace adapters / registries (outside `infrastructure/` but listed in 4.16) | Inheritance + mutable registration maps |

### 2.3 Possible factory candidates (not approved for immediate conversion)

| Symbol | Consumers (composition) | State | Tests today | Notes |
|--------|-------------------------|-------|-------------|-------|
| `FetchHttpClient` | `createInfrastructure` → webhooks outbound / workers | Logger + `defaultTimeoutMs` only; **no** socket ownership | **Characterized (Phase 4.20)** — `tests/unit/infrastructure/fetch-http-client.test.js` | Retries, timeouts, request-id/trace headers, redaction — behavior-rich |
| `RedisCache` | `createInfrastructure` | Holds `RedisConnection` + keys + logger | No dedicated unit suite | Small API (`get`/`set`/`delete`); poison-entry delete side effect |
| `PostgresOutboxRepository`, `PostgresInboxRepository` | `createInfrastructure` | Borrow DB / queryable | Mostly integration | Same borrow pattern as module repos |
| Module `Postgres*Repository` (e.g. audit) | `create*Module` | Borrow `tx` | Mixed | Large surface; pilot only after infra helpers settle |
| Worker handler classes | Worker wiring | Thin routers | Partial | Separate track from infra helpers |

---

## 3. Candidate evaluation (leading options)

### A. `FetchHttpClient` — leading conversion candidate (**characterized in Phase 4.20**)

| Field | Assessment |
|-------|------------|
| API | `constructor({ config, logger })`, `send(request)` (+ private `sendOnce`) |
| Ownership | None (uses global `fetch`) |
| Risks | Retry only for GET/HEAD on timeout; `ExternalService*` error mapping; AbortController; ALS request context; traceparent |
| Coverage (4.20) | Dedicated unit suite: success/JSON/text/empty/malformed JSON; headers/body/redirect; request-id + traceparent; HTTP error vs `returnErrorResponses`; network wrap; timeout→`ExternalServiceTimeoutError`; GET/HEAD retry; POST/PUT no-retry; no retry on status errors; URL redaction in debug logs |
| Remaining gaps | DELETE timeout (same as PUT — expected no retry); number/boolean/bigint body coercion; concurrent `send` stress; live integration against real TLS |
| Ambiguity preserved | Comment/`IDEMPOTENT_METHODS` includes PUT/DELETE, but `maxAttempts` is 2 only for GET/HEAD — PUT/DELETE **do not** retry (characterized, not changed) |
| Scope if converted | Client file + `createInfrastructure` (+ deprecated wrapper); consumers use `httpClient.send` |
| Disposition | **Migrated in Phase 4.21** — `createFetchHttpClient`; deprecated wrapper retained; see Phase 4.22 for next-step recommendation |

### B. `RedisCache` — smaller API, still connection-backed

| Field | Assessment |
|-------|------------|
| API | `get` / `set` / `delete` |
| Ownership | Does not own Redis; **holds** connection reference |
| Risks | JSON poison path deletes key; TTL validation; key-builder coupling (already factory) |
| Coverage gap | No dedicated unit tests with fake connection |
| Disposition | **Defer** behind HTTP characterization or treat as P3 with fake-Redis tests first |

### C. Security clients (`AesSecretEncryptor`, `JoseAccessTokenService`)

| Disposition | **Defer** — do not auto-prioritize after P1; any conversion needs ciphertext/JWT fixtures and auth regression plan |

### D. Module repository pilot (`PostgresAuditRepository`)

| Disposition | **Defer** — valid later (P5), but larger cross-module blast radius than remaining infra helpers; not the safest immediate next step |

---

## 4. Phase 4.20 / 4.21 status

### Phase 4.20 (done): Characterize `FetchHttpClient` — **no factory**

- Added `tests/unit/infrastructure/fetch-http-client.test.js` (stubbed `fetch`, no live network).
- Runtime implementation and public API **unchanged**.
- Documented PUT/DELETE vs GET/HEAD retry asymmetry as current contract.

### Phase 4.21 (done): `createFetchHttpClient`

- Factory: `createFetchHttpClient({ config, logger })` → `{ send }`.
- Composition: `src/app/create-infrastructure.js` uses the factory.
- Deprecated `FetchHttpClient` class wrapper retained (`new FetchHttpClient({ config, logger })` returns the factory result).
- Characterization suite extended for factory + wrapper parity; HTTP/retry policy **unchanged** (including PUT/DELETE no-retry asymmetry).
- `MarketplaceHttpClient` not modified.

**After that:** `RedisCache` (fake connection tests) → lock/rate-limit only with concurrency fixtures → module repo pilot.

**Do not** start AES/JWT/S3/idempotency/retention/lock/rate-limit conversions without a dedicated design review.

---

## 5. Prerequisites before any further infra factory phase

| Prerequisite | Purpose |
|--------------|---------|
| Characterization tests for the chosen target | Parity without weakening crypto/HTTP/Redis semantics |
| Confirm single active composition root | Avoid updating deleted/ghost bootstrap paths |
| Keep Nest + Express / DI boundaries | Factories return plain objects; Nest adapters stay classes |
| No `.env` / algorithm / key-format / SQL changes | Same rules as 4.17–4.18 |
| Known unit failures stay out of scope | marketplace-worker / channels / rotate-webhook-secret (pre-existing) |

---

## 6. Documentation drift addressed in this phase

| Doc | Issue | Action |
|-----|-------|--------|
| `phase-4-16-…inventory.md` | Header still said “no infrastructure classes converted” | Status note updated to point at 4.17–4.19 |
| Same | §9 still listed Redis/Argon2 as future candidates | Rollup updated; details remain historical in §3 |
| `function-based-mvc-migration.md` | No 4.19 row | Phase table updated |

---

## 7. Confirmation (Phase 4.19 constraints)

| Constraint | Status |
|------------|--------|
| No runtime implementation converted | **Confirmed** (docs only) |
| No auth / Redis key / schema / API / `.env` changes | **Confirmed** |
| No Fastify / Nest runtime change | **Confirmed** |
| No commit / PR / deploy | **Confirmed** |
| No attempt to fix pre-existing unit failures | **Confirmed** |

**Stop (historical for 4.19/4.21):** FetchHttpClient factory complete. **Current next-step audit:** [phase-4-22-function-based-mvc-progress-audit.md](./phase-4-22-function-based-mvc-progress-audit.md) — pause further infra factories; prefer API Keys business factories next.
