# Phase 4.22 — Function-Based MVC Migration Progress Audit

**Status:** Audit / documentation only — **no runtime conversions**  
**Date:** 2026-10-19  
**Prerequisite:** Phases 4.12–4.15 (O/C/S/R business factories), 4.16–4.21 (infra inventory → FetchHttpClient factory)  
**Runtime constraint:** NestJS + Express unchanged  

Related: [function-based-mvc-migration.md](./function-based-mvc-migration.md), [phase-4-16-infrastructure-class-inventory.md](./phase-4-16-infrastructure-class-inventory.md), [phase-4-19-infrastructure-post-migration-audit.md](./phase-4-19-infrastructure-post-migration-audit.md).

---

## 1. Verification of Phases 4.17–4.21 (repository evidence)

| Phase | Claim | Evidence on disk | Result |
|-------|--------|------------------|--------|
| **4.17** | `createRedisKeyBuilder` + deprecated `RedisKeyBuilder` | `src/infrastructure/redis/redis-keys.js`; composition `src/app/create-infrastructure.js`, `src/app/create-nest-infrastructure.js`; tests `tests/unit/infrastructure/redis-keys.test.js` | **Verified** |
| **4.18** | `createArgon2PasswordHasher` + deprecated wrapper | `src/infrastructure/auth/argon2-password-hasher.js`; `src/modules/identity/index.js`; tests `tests/unit/infrastructure/argon2-password-hasher.test.js` | **Verified** |
| **4.19** | Post-migration audit / pause guidance | `docs/architecture/phase-4-19-infrastructure-post-migration-audit.md` | **Verified** (docs) |
| **4.20** | FetchHttpClient characterization (no factory at the time) | Suite now also covers factory path after 4.21 | **Verified** (history preserved) |
| **4.21** | `createFetchHttpClient` + deprecated `FetchHttpClient` | `src/infrastructure/http/fetch-http-client.js`; `createInfrastructure` uses factory; `MarketplaceHttpClient` untouched; tests **24** cases in `fetch-http-client.test.js` | **Verified** |

### Compatibility wrappers

All three use the established pattern: `constructor(…) { return create*(…); }`.

| Limitation | Status |
|------------|--------|
| `instanceof FetchHttpClient` / `RedisKeyBuilder` / `Argon2PasswordHasher` is **false** for constructed values | Documented; no production `instanceof` consumers found for these symbols |
| Ghost search hits on deleted `src/app/bootstrap/create-infrastructure.js` / `src/nest/bootstrap/…` | Paths **absent on disk**; active composition is `src/app/create-infrastructure.js` (+ nest light infra) |

### FetchHttpClient retry contract (must remain unchanged)

Confirmed in `fetch-http-client.js`:

- `IDEMPOTENT_METHODS` = GET, HEAD, PUT, DELETE  
- `maxAttempts` = 2 **only** for GET/HEAD  
- PUT/DELETE therefore **do not** retry on timeout (characterized; not “fixed”)  
- POST never auto-retried  

---

## 2. Documentation reconciliation (this phase)

| Doc | Correction |
|-----|------------|
| `function-based-mvc-migration.md` | Add 4.22; clarify 4.19 is historical pause-before-HTTP; update acceptance note for OCSR + infra P1/HTTP factories |
| `phase-4-19-…audit.md` | Mark FetchHttpClient disposition as migrated in 4.21; stop line → 4.22 |
| `phase-4-16-…inventory.md` | Stop line → 4.22 progress audit |

Stale narrative left as historical where it describes the as-of-4.16 state (e.g. §3 tables that still list symbols before migration notes in later columns).

---

## 3. Remaining migration scope (grouped)

Approximate under `src/modules/**/services/**`: **~44** `export function create*` vs **~194** `export class` (includes deprecated wrappers, errors, and Nest-adjacent classes). O/C/S/R core use cases are factory-migrated with deprecated class wrappers retained.

### 3.1 Business-service migrations still required (primary MVC roadmap)

| Area | Notes | Priority |
|------|-------|----------|
| Identity / auth / MFA use cases | Still `*UseCase` classes; security-sensitive | Medium (needs careful parity) |
| API keys | Small set: create/list/rotate/revoke/verify — good next business pilot | **High for next conversion** |
| Products, offers, pricing, inventory | Class-based services remain | Medium |
| Commerce integrations / marketplaces connections | Credential paths; medium risk | Medium |
| Compatibility (StockConnect / compat-v2) | Large surface; external contracts | Medium–high |
| Webhooks outbound / marketplace webhook | Several service classes; delivery already injects `httpClient.send` | Medium |
| Integration-catalog-sync | Schedulers + sync services | Medium |
| Orders marketplace-ingestion | Several job/lifecycle **classes** remain (separate from O/C/S/R core) | Medium; overlaps failing worker tests |

### 3.2 Infrastructure factory candidates (understood enough to plan, not convert blindly)

| Candidate | Prerequisite | Recommendation |
|-----------|--------------|----------------|
| `RedisCache` | Characterization with fake `RedisConnection` (mirror 4.20) | Next **infra** step only after business priority decision |
| Outbox/inbox repos | Borrow-DB pattern review | Later |
| Module `Postgres*Repository` pilot | One small repo + integration | Later (P5) |

### 3.3 Keep as classes

Resource owners (`PostgresDatabase`, `RedisConnection`, BullMQ, outbox/inbox loops, Prometheus, S3), Nest controllers/modules/guards/filters, domain `models/`, error subclasses, marketplace adapter inheritance tree.

### 3.4 Defer (characterization / security / concurrency)

`AesSecretEncryptor`, `JoseAccessTokenService`, `RedisDistributedLock`, `RedisRateLimiter`, `PostgresIdempotencyService`, retention SQL helpers, adapter registries.

### 3.5 Separate investigation (not factory migration)

| Item | Evidence |
|------|----------|
| `marketplace-worker-channel-resolution` — 8 failures | `commerceIntegrationQueryService` undefined in `ExecuteMarketplaceLifecycleJob` test wiring (seen in 4.17–4.21 full `test:unit` runs) |
| `tests/unit/channels/resolve-channel-queryable.test.js` | Suite load failure — imports removed `src/modules/channels/…` |
| `tests/unit/webhooks/rotate-webhook-secret.test.js` | Suite load failure — broken `audit/public` import from outbound service |
| `arch:check` orphan warnings (~75) | 0 errors; warnings pre-exist across audits |

---

## 4. Validation baseline (as of Phase 4.21 completion report; not re-executed in 4.22)

| Check | Result | Notes |
|-------|--------|-------|
| Focused infra unit suites (redis-keys, argon2, fetch-http-client) | **Pass** (12 / 5 / 24) | Verified during 4.17–4.21 |
| Webhook delivery consumer unit | **Pass** (7) | With 4.21 |
| `build` / `verify:naming` / `arch:check` | **Pass** (0 arch errors) | Orphan warnings remain |
| Full `test:unit` (4.21) | **779 passed**; **8 failed** + **2 suite loads** | Same three failure clusters as above — treat as **established baseline** from sequential phase runs, not re-verified in 4.22 |
| Integration / Jest | **Not run** in 4.17–4.22 infra phases | Limitation |

---

## 5. Recommended next phase

### Recommendation: **Pause further infrastructure factory conversions**

P1 (keys, Argon2) and the first characterized P2 client (`FetchHttpClient`) are complete. The next infra item (`RedisCache`) still lacks characterization tests. Continuing infra now would outpace the primary unfinished work: **business use-case factories**.

### Recommended Phase 4.23 (single next conversion track)

**Objective:** Convert the **API Keys** module use cases to Wasl factory functions (`createCreateApiKey`, etc.), following Phases 4.12–4.15 patterns, with deprecated class wrappers as needed.

| Field | Detail |
|-------|--------|
| **Scope** | `src/modules/api-keys/services/use-cases/*` + `createApiKeysModule` wiring; Nest controllers remain classes; no schema/API/`.env` changes |
| **Evidence needed** | Five use-case classes remain; module already has `createApiKeysModule`; existing unit coverage (`tests/unit/api-keys/…`) |
| **Risk** | Low–medium (secrets/hashing of API key material — preserve exact hashing/encoding) |
| **Dependencies** | Do not convert `PostgresApiKeyRepository` in the same phase; do not touch marketplace-worker failures unless they block API-key tests |
| **Acceptance** | Factories + wrappers; composition uses factories; focused api-keys unit tests green; no change to key formats or public HTTP contracts |

**Explicitly not 4.23:** RedisCache/AES/JWT conversion; fixing channels/rotate-webhook-secret suite loads (track as a **separate quality/triage** task if desired).

---

## 6. Confirmation (Phase 4.22 constraints)

| Constraint | Status |
|------------|--------|
| No runtime implementation converted | **Confirmed** |
| No business logic / API / schema / `.env` changes | **Confirmed** |
| NestJS + Express retained | **Confirmed** |
| No commit / PR / deploy | **Confirmed** |

**Follow-up (executed in master completion batch):** API Keys + Tenants factories landed; migration-related suite failures fixed. Remaining business modules stay on the deferred backlog in `function-based-mvc-migration.md`.
