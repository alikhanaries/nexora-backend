# StockConnect CE compatibility — operations

Operational requirements for running Nexora as the ChannelEngine-compatible backend for StockConnect. This document lists **configuration names and data requirements only** — never commit secrets or production URLs.

## Verification status legend

| Label | Meaning |
| ----- | ------- |
| **IMPLEMENTED** | Code exists on `origin/dev` under `/api/v2/ce/*` |
| **TESTED LOCALLY** | Automated unit/integration tests pass in CI/local |
| **INTEGRATION VERIFIED** | Live StockConnect client exercised against Nexora (not claimed by default) |
| **STAGING VERIFIED** | Controlled staging cutover succeeded |
| **PRODUCTION VERIFIED** | Production cutover succeeded |
| **BLOCKED BY ENVIRONMENT** | Waiting on infra, credentials, or client configuration |

## StockConnect client configuration (StockConnect side)

| Setting | Purpose |
| ------- | ------- |
| `CHANNEL_ENGINE_BASE_URL` | Must include the CE prefix, e.g. `https://<nexora-host>/api/v2/ce/` |

Nexora does **not** read `CHANNEL_ENGINE_BASE_URL`; it is configured only in StockConnect.

## Nexora tenant configuration (per tenant)

| Item | Requirement | Status |
| ---- | ----------- | ------ |
| API key | StockConnect polls and mutates via query `apiKey` / `apikey` or header `X-CE-KEY` on **`/api/v2/ce/*` only** | IMPLEMENTED, TESTED LOCALLY |
| Tenant scope | API key is bound to exactly one Nexora tenant | IMPLEMENTED, TESTED LOCALLY |
| Channel `external_reference` | Must be a **numeric string** when StockConnect expects integer `ChannelId` / `GlobalChannelId` | IMPLEMENTED — non-numeric refs omit integer IDs (by design) |
| CE order integer `Id` | Stored in `external_integer_id_mappings` (`compat_v2` provider); stable across repeated GET polls | IMPLEMENTED, TESTED LOCALLY (Phase 52 regression) |
| Webhook subscription | `description` = `stockconnect-ce-bridge`, URL = StockConnect `POST /orders/channelengine-webhook`, event types for order lifecycle | IMPLEMENTED, TESTED LOCALLY |
| Webhook secret | Stored encrypted in Nexora; never logged | IMPLEMENTED |

## Nexora application environment

StockConnect CE compatibility uses existing Nexora infrastructure. No additional `STOCKCONNECT_*` environment variables are required on the Nexora API.

| Dependency | Used for |
| ---------- | -------- |
| `DATABASE_URL` | Tenant data, idempotency, webhook deliveries, CE integer Id mappings |
| `REDIS_URL` | Rate limits, auth/login limits |
| `QUEUE_REDIS_URL` / `QUEUE_PREFIX` | Webhook delivery and marketplace lifecycle workers |
| `AUTH_*` / JWT | Native UI and Bearer access to non-CE routes |

Startup fails fast on invalid **global** config via `src/app/config/schema.js`. Missing **tenant** webhook or API key configuration surfaces as runtime 401/404 on CE calls, not as opaque 500s.

## Readiness

`GET /health/ready` includes probe `stockconnect_ce_compat`, which verifies StockConnect CE route handlers are wired. It does **not** call StockConnect or ChannelEngine.

## Out of scope (not CE replacement)

- CE async job / batch / queue admin APIs
- External StockConnect availability as a Nexora health dependency

## Staging / production

All live StockConnect flows remain **BLOCKED BY ENVIRONMENT** until ops runs controlled staging with real API keys, numeric channel references, webhook URL/secret, and `CHANNEL_ENGINE_BASE_URL` pointing at Nexora staging.

## Production cutover (Phase 54)

Full checklist, monitoring, rollback, smoke test, and cutover sequence: **[stockconnect-ce-production-cutover.md](./stockconnect-ce-production-cutover.md)**.

| Gate | Status |
| ---- | ------ |
| Code on `origin/dev` (Phases 44–52, #68) | **IMPLEMENTED** |
| Staging E2E with real StockConnect (Phase 53 / Phase 56) | **Not completed** — Phase 56 blocked by environment (#69 matrix; no client run) |
| Production traffic | **PRODUCTION NOT YET VERIFIED** |
| Production configuration (secrets/URLs) | **PRODUCTION CONFIG READY** (checklist; Ops must populate) |
