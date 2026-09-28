# StockConnect CE — production cutover readiness (Phase 54)

Operational runbook for a **controlled production cutover** from ChannelEngine to Nexora `/api/v2/ce/*`. This document contains **no secret values**. Actual cutover is an explicit Ops/business action after staging evidence is reviewed.

**Related:** [compatibility-matrix.md](./compatibility-matrix.md), [stockconnect-ce-operations.md](./stockconnect-ce-operations.md)

## Status legend (Phase 54)

| Label | Meaning |
| ----- | ------- |
| **IMPLEMENTED** | Engineering complete on `origin/dev` |
| **STAGING VERIFIED** | Real StockConnect staging client succeeded against Nexora staging |
| **PRODUCTION CONFIG READY** | Production secrets/URLs mapped in approved stores (not verified by traffic) |
| **PRODUCTION NOT YET VERIFIED** | No production StockConnect traffic against Nexora CE |

Do **not** label the system “production ready” until production cutover completes and is signed off.

---

## Phase 53 evidence (source of truth)

Phase 53 (#67, branch `feat/phase-53-stockconnect-ce-staging-e2e`) recorded **documentation and local test gates only**.

| Area | Real StockConnect staging traffic? |
| ---- | ----------------------------------- |
| Orders poll / acknowledge | **No** — NOT TESTED with live client |
| Stable CE `Id` | **No** — local integration only |
| Catalog / channels / offer / stock | **No** |
| Shipments / returns | **No** |
| Invoice / ParseInvoice | **No** |
| Webhook bridge | **No** |
| Marketplace order visibility | **No** |
| Tenant isolation / errors (live) | **No** — automated tests only |

**Conclusion:** Staging E2E with StockConnect remains **BLOCKED BY ENVIRONMENT** until Ops runs controlled staging. Production cutover must **not** proceed on local/CI evidence alone.

**Engineering baseline on `origin/dev` (post #68):** Phases 44–50, 52 merged; Phase 52 adds `stockconnect_ce_compat` readiness and webhook destination logging.

---

## Production route inventory (actual code)

Verified from `src/modules/compatibility/presentation/stockconnect-ce.routes.js` and `tests/integration/stockconnect-ce-route-inventory.test.js`.

| Method | Nexora route |
| ------ | ------------- |
| GET | `/api/v2/ce/orders` |
| POST | `/api/v2/ce/orders/acknowledge` |
| GET | `/api/v2/ce/orders/:merchantOrderNo/invoice` |
| GET | `/api/v2/ce/products` |
| POST | `/api/v2/ce/products` |
| POST | `/api/v2/ce/products/freeze` |
| POST | `/api/v2/ce/products/bulkdelete` |
| PATCH | `/api/v2/ce/products/extra-data/bulk` |
| PUT | `/api/v2/ce/offer` |
| PUT | `/api/v2/ce/offer/stock` |
| GET | `/api/v2/ce/channels` |
| GET | `/api/v2/ce/channels/:channelId/products` |
| POST | `/api/v2/ce/shipments` |
| GET | `/api/v2/ce/shipments/merchant` |
| PUT | `/api/v2/ce/shipments/:merchantShipmentNo/delivery-state` |
| GET | `/api/v2/ce/returns` |
| POST | `/api/v2/ce/returns/merchant` |
| POST | `/api/v2/ce/returns/merchant/acknowledge` |
| PUT | `/api/v2/ce/returns` |
| POST | `/api/v2/ce/cancellations` |

StockConnect CE surface also includes **cancellations** (registered route; confirm StockConnect client usage before relying on it in production).

Auth for CE routes: query `apiKey` / `apikey` or header `X-CE-KEY` on `/api/v2/ce/*` only.

---

## Production configuration checklist

### Nexora platform

| Item | Verify | Status |
| ---- | ------ | ------ |
| PostgreSQL (`DATABASE_URL`) | Migrations applied; RLS app role | PRODUCTION CONFIG READY (template) |
| Redis (`REDIS_URL`) | Rate limits / auth | PRODUCTION CONFIG READY (template) |
| Queue Redis + workers (`QUEUE_REDIS_URL`, worker process) | Webhook delivery + marketplace lifecycle jobs | PRODUCTION CONFIG READY (template) |
| Object storage | If used by non-CE features | Per deployment |
| Public application URL | TLS, routing to API | Ops |
| Compatibility module | Deploy build from merged `dev` (#68+) | IMPLEMENTED |
| Readiness | `GET /health/ready` → `checks.stockconnect_ce_compat` = `ok` | IMPLEMENTED |
| Logging | Structured logs; no secrets in CE/webhook fields | IMPLEMENTED (Phase 52) |

`stockconnect_ce_compat` does **not** require StockConnect online. Other probes (postgres, redis, queue, storage) may fail readiness independently.

### StockConnect (client)

| Item | Verify | Status |
| ---- | ------ | ------ |
| `CHANNEL_ENGINE_BASE_URL` | Points to Nexora production host with `/api/v2/ce/` prefix | PRODUCTION NOT YET VERIFIED |
| CE API key | Nexora-issued key for correct tenant; scopes match usage | PRODUCTION NOT YET VERIFIED |
| Tenant mapping | One key → one Nexora tenant (no shared/fallback tenant) | PRODUCTION NOT YET VERIFIED |
| Webhook URL | StockConnect `POST /orders/channelengine-webhook` reachable from Nexora workers | PRODUCTION NOT YET VERIFIED |
| Webhook secret | Stored in Nexora subscription (encrypted); paired with StockConnect | PRODUCTION NOT YET VERIFIED |

### Channel mapping

| Field | Requirement |
| ----- | ------------- |
| `channels.external_reference` | Numeric string when StockConnect expects integer `ChannelId` / `GlobalChannelId` |
| `ChannelName` / `GlobalChannelName` | From Nexora channel name in CE mappers |
| Non-numeric `external_reference` | Integer IDs omitted in CE responses (by design) |

### Order compatibility

| Item | Requirement |
| ---- | ----------- |
| CE integer `Id` | `external_integer_id_mappings` provider `compat_v2`; stable across repeat `GET /api/v2/ce/orders` |
| `MerchantOrderNo` | Nexora order number |
| `ChannelOrderNo` | External/channel order reference on the order |
| Backfill | Existing production orders may need mappings before CE poll shows `Id`; plan repeat-safe backfill with Ops (no destructive SQL in this repo phase) |

### Webhook bridge (Nexora → StockConnect)

| Setting | Value |
| ------- | ----- |
| Subscription `description` | `stockconnect-ce-bridge` (exact) |
| Event types | `order.created`, `order.confirmed`, `order.status_changed`, `order.cancelled` (subset allowed) |
| Delivery | HMAC on body (`X-Nexora-Signature`); idempotent delivery records; retries via existing webhook worker |

---

## Secret and configuration safety

- Secrets only in approved secret stores / encrypted DB fields — **never** in git, docs, or logs.
- Do not commit `.env`, API keys, or webhook secrets.
- Webhook logs use `destinationHost` / `destinationPath` only (credentials stripped).
- CE error envelope does not expose stack traces or DB errors to clients.

---

## Idempotency (pre-cutover audit summary)

| Operation | Mechanism |
| --------- | --------- |
| CE order acknowledge | Deterministic idempotency key when header omitted; Postgres idempotency for explicit keys |
| CE catalog mutations | Idempotency + domain commands (Phase 45 / CE catalog command) |
| Shipments / returns (CE) | Delegates to existing compatibility commands + idempotency |
| Webhook delivery | Delivery row state machine; same event/subscription/tenant does not double-deliver success |

No change to global idempotency in Phase 54.

---

## Tenant isolation (pre-cutover)

- API key verification binds `tenantId` on every CE handler.
- Cross-tenant resource access returns controlled 404/403 (existing architecture).
- Validate in production: issue a key for tenant A and confirm tenant B data never appears in CE poll/catalog/invoice.

---

## Pagination / polling sanity

StockConnect uses `page`, `pageSize`; Nexora CE orders return `TotalCount`, `ItemsPerPage`, `Content`. Stable CE `Id` per order across repeated polls is covered by local integration tests — re-verify under staging load parameters.

---

## Monitoring after cutover

Use existing logs and metrics (no new monitoring product required).

### Orders

- `GET /api/v2/ce/orders` 4xx/5xx rate
- Empty or unexpected `Content` vs marketplace ingestion
- Duplicate order creation (should not occur on acknowledge retry)
- Acknowledge failures (`POST /api/v2/ce/orders/acknowledge`)

### Catalog

- Product POST/freeze/bulkdelete/extra-data failures
- Offer price/stock PUT failures

### Fulfillment

- Shipment create / delivery-state PUT failures

### Returns

- Return list / merchant create / acknowledge / PUT receive failures

### Invoice

- Invoice route 404 vs 500
- Non-PDF responses
- StockConnect ParseInvoice errors (client-side; correlate with Nexora 200 + `application/pdf`)

### Webhooks

- Log lines: `Webhook delivery started` / `succeeded` / `failed and will be retried` / `dead-lettered`
- Fields: `tenantId`, `eventType`, `eventId`, `destinationHost`, `attempt`, `httpStatus`, `nextAttemptAt`, `lastError`
- Dead-letter and retry exhaustion counts

### Authentication

- CE 401 rate (invalid/missing API key)

---

## Rollback strategy

1. **Revert StockConnect `CHANNEL_ENGINE_BASE_URL`** to the previous ChannelEngine production base URL (Ops config change).
2. **Stop Nexora CE traffic** — StockConnect no longer calls Nexora; no Nexora code rollback required for immediate traffic stop.
3. **In-flight webhooks** — Nexora may still enqueue deliveries until subscription disabled or URL points elsewhere; disable or pause `stockconnect-ce-bridge` subscription before cutover if a clean boundary is required.
4. **Queued webhook deliveries** — Existing BullMQ jobs drain per worker; dead-letter table retains failed rows for inspection.
5. **Duplicate events after rollback** — StockConnect should treat CE order state from ChannelEngine as authoritative again; Nexora webhook deliveries after rollback should be disabled to avoid dual ingestion.
6. **Already acknowledged orders** — Orders acknowledged in Nexora remain in Nexora DB; ChannelEngine may hold different state until reconciled manually per business process.

No rollback automation added in Phase 54.

---

## Recommended cutover sequence

1. Verify production Nexora deployment (build includes #68+).
2. Verify `GET /health/ready` → `stockconnect_ce_compat` = `ok` (and infra probes as required by Ops).
3. Verify database, Redis, workers running.
4. Verify production API key (tenant, scopes) in secret store.
5. Verify tenant ↔ StockConnect merchant mapping.
6. Verify channel `external_reference` numeric values for production channels.
7. Verify / backfill CE integer `Id` mappings for in-scope orders if needed.
8. Configure StockConnect production `CHANNEL_ENGINE_BASE_URL` (maintenance window / feature flag per Ops).
9. Enable **controlled** traffic (single tenant or canary — per approved rollout plan).
10. Monitor order polling and acknowledgement.
11. Monitor catalog sync paths.
12. Monitor shipments and returns.
13. Monitor invoice requests.
14. Monitor webhook delivery metrics/logs.
15. Confirm stability against agreed criteria.
16. Expand traffic per approved rollout plan.

No percentages or timings invented here.

---

## Production smoke test (non-destructive)

Only with Ops authorization. Avoid fake shipments, returns, cancellations, bulk deletes, or acknowledge unless using an approved test order/tenant.

| Check | Action |
| ----- | ------ |
| Readiness | `GET /health/ready` — `stockconnect_ce_compat` ok |
| Auth | `GET /api/v2/ce/orders?page=1&pageSize=1` with valid query API key → 200 |
| Auth negative | Invalid key → 401 |
| Channels | `GET /api/v2/ce/channels` with valid key |
| Orders (read) | Poll with small `pageSize`; inspect shape, no PII in logs |
| Products (read) | `GET /api/v2/ce/products?merchantProductNoList=…` for known SKU |
| Invoice | `GET /api/v2/ce/orders/:merchantOrderNo/invoice` for **approved** test order only; `Content-Type` PDF |
| Webhook health | Inspect recent `stockconnect-ce-bridge` delivery rows / logs (no secret payload logging) |

---

## Canary order (if approved)

If Ops designates a production test order:

1. StockConnect ingests/polls order via Nexora CE.
2. Nexora emits lifecycle event → webhook → StockConnect `channelengine-webhook`.
3. Invoice fetched → StockConnect ParseInvoice.

Do not document customer PII in engineering reports.

---

## Known limitations

- CE async job / batch / queue admin APIs not implemented (not required by StockConnect usage).
- Non-numeric channel `external_reference` → no integer `ChannelId`.
- Staging/production ParseInvoice and live webhook paths unverified without environment runs.
- Performance/load testing against production is an Ops activity, not this phase.

---

## Phase 54 assessment

| Gate | Status |
| ---- | ------ |
| Engineering on `origin/dev` | **IMPLEMENTED** |
| Staging E2E (StockConnect client) | **PRODUCTION NOT YET VERIFIED** / staging incomplete |
| Production config templates | **PRODUCTION CONFIG READY** (checklist only) |
| Production traffic | **Not executed** |

**Final engineering assessment:** **READY FOR CONTROLLED PRODUCTION CUTOVER** (documentation and code baseline). **Not permission to cut over** — requires staging sign-off and Ops execution.
