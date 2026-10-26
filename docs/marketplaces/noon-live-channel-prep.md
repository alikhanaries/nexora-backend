# Noon live channel — operator prep (Wasl)

## Phase 2 local resources (2026-10-26)

| Resource | ID |
| -------- | -- |
| Tenant `stockconnect-local` | `5df6a7c0-c917-44a5-960e-d969d07909ce` |
| Marketplace `noon` | `e0b1d2cd-e5fb-4352-aa68-05b9736d2492` |
| Channel **Noon Live Channel** | `c068bc73-e586-4512-94b9-e95f1121f0d5` |
| Default stock location | `5fd022f1-9741-45f6-884e-5ac334d1f72a` |

Compatibility channels (`sc_mp_*`) were **not** modified.

## Local credential file (configuration only)

| Item | Status |
| ---- | ------ |
| File | `.env.noon.local` (gitignored via `.env.*`) |
| Template | `env.noon.local.example` |
| Bootstrap | `scripts/dev-noon-connection-bootstrap.mjs` (do **not** run until all required vars are set) |

**Maps to Wasl connection API** (`readNoonServiceAccount` / bootstrap payload):

| Env var | Credential JSON field | Notes |
| ------- | --------------------- | ----- |
| `NOON_KEY_ID` | `key_id` | Replacement required if credential was exposed |
| `NOON_PRIVATE_KEY_PEM` | `private_key` | **Never** use chat-exposed PEM; rotate with owner |
| `NOON_PROJECT_CODE` | `project_code` | e.g. `PRJ352239` when confirmed with owner |
| `NOON_COUNTRY_CODE` | — | Pending: `ae`, `sa`, or `eg` |
| `NOON_WAREHOUSE_CODE` | — | Pending from Seller Lab / owner |
| `WASL_NOON_CHANNEL_ID` | — | `c068bc73-e586-4512-94b9-e95f1121f0d5` |
| `WASL_ADMIN_PASSWORD` | — | From operator `.env.stockconnect.local` (not committed) |

**Reference only (not stored in Wasl env):** credential `type` (`apijwt`), `channel_identifier`, `issued_at` — keep in operator runbook, not new env vars.

---

# Noon live channel — Phase 1 operator prep (Wasl)

Read-only preparation checklist. Do **not** treat completed HTTP steps as proof Noon accepted anything. Stop before product publish, order actions, webhook registration in Noon, or `POST …/marketplace-connection/test` unless explicitly authorized.

## Prerequisites (environment)

| Requirement | Source |
| ----------- | ------ |
| Wasl API + Postgres + Redis (queue) | Same as local/prod compose |
| `AUTH_MFA_ENCRYPTION_KEY` (32 bytes) | Encrypts marketplace connection credentials at rest (`.env.example`) |
| Optional `NOON_API_BASE_URL`, `NOON_USER_AGENT` | Deployment defaults; override per connection `configuration` |
| `DATABASE_MIGRATION_URL` | Owner role for migrations when `DATABASE_URL` is `wasl_app` |
| Worker process | `npm run dev:worker` / `start:worker` — required for catalog sync and lifecycle jobs after setup |

Default Noon gateway when unset: `https://noon-api-gateway.noon.partners` (`noon-config.js`).

## Permissions

| Action | Permission | Fallback |
| ------ | ---------- | -------- |
| List/get marketplaces | `marketplaces.read` | `tenant.admin` |
| Create/update marketplace | `marketplaces.manage` | `tenant.admin` |
| List/get/create/patch channels | `channels.read` / `channels.create` / `channels.update` | — |
| Upsert/patch/delete/test connection | `channels.update` | — |

Marketplaces are **global** (not tenant-scoped). Channels and connections are **tenant-scoped**.

## Step 0 — Discover existing rows (avoid duplicates)

**SQL (read-only):**

```sql
SELECT id, key, status FROM marketplaces WHERE key = 'noon';

SELECT c.id, c.name, m.key AS marketplace_key, c.default_stock_location_id
FROM channels c
JOIN marketplaces m ON m.id = c.marketplace_id
JOIN tenants t ON t.id = c.tenant_id
WHERE t.slug = '<tenant-slug>';

SELECT mc.channel_id, mc.marketplace_key, mc.status,
       (mc.webhook_ingress_token_hash IS NOT NULL) AS has_ingress_hash,
       mc.configuration->>'countryCode' AS country,
       mc.configuration->>'warehouseCode' AS warehouse,
       mc.last_test_outcome
FROM marketplace_connections mc
JOIN tenants t ON t.id = mc.tenant_id
WHERE t.slug = '<tenant-slug>' AND mc.status = 'ACTIVE';
```

**HTTP:** `GET /api/v1/marketplaces`, `GET /api/v1/channels?marketplaceId=<uuid>` (tenant JWT or scoped API key).

Only create a marketplace with key `noon` if the first query returns **zero** rows.

## Step 1 — Marketplace record (global)

If missing:

`POST /api/v1/marketplaces`

Body schema (`createMarketplaceBodySchema`):

```json
{
  "key": "noon",
  "name": "Noon"
}
```

Rules: key normalized to lowercase; pattern `^[a-z][a-z0-9_]*$` (`marketplace-key.js`).

## Step 2 — Dedicated Noon channel (tenant)

`POST /api/v1/channels`

Body schema (`createCommerceIntegrationBodySchema`):

```json
{
  "marketplaceId": "<uuid-of-marketplace-noon>",
  "name": "Noon Live (test)",
  "externalReference": null,
  "configurationReference": null,
  "defaultStockLocationId": "<uuid-stock-location>"
}
```

- `defaultStockLocationId` must reference an existing tenant stock location (verified on create).
- Required for FBPI order ingest (`requireChannelStockLocationId`).
- Do **not** reuse a channel whose marketplace key is `sc_mp_*` — adapters resolve by `marketplaces.key`, not channel display name.

Optional later: `PATCH /api/v1/channels/:channelId` with same schema fields + optional `status` (`ACTIVE` | `INACTIVE` | `SUSPENDED`).

## Step 3 — Marketplace connection (credentials stay out of logs)

`POST /api/v1/channels/:channelId/marketplace-connection`

Body schema (`marketplaceConnectionBodySchema`):

```json
{
  "credentials": { },
  "configuration": { }
}
```

Both are arbitrary JSON objects at the HTTP layer; Noon adapter validates at runtime.

### Noon `credentials` (encrypted at rest; never returned on GET)

From `readNoonServiceAccount` (`noon-config.js`):

| Field | Aliases | Required |
| ----- | ------- | -------- |
| `keyId` | `key_id` | yes |
| `privateKey` | `private_key` | yes (PEM; `\n` allowed escaped) |
| `projectCode` | `project_code` | yes, or set on `configuration.projectCode` |

### Noon `configuration`

| Field | Required | Notes |
| ----- | -------- | ----- |
| `countryCode` | yes | `ae`, `sa`, or `eg` (lowercase enforced) |
| `warehouseCode` | yes | Noon stock API warehouse |
| `apiBaseUrl` | no | HTTPS; validated if set |
| `userAgent` | no | Default `Wasl/1.0` or `NOON_USER_AGENT` |
| `projectCode` | no | Fallback for login if omitted in credentials |

Partial update: `PATCH /api/v1/channels/:channelId/marketplace-connection` with optional `credentials` / `configuration` (merged for configuration).

Read metadata (no secrets): `GET /api/v1/channels/:channelId/marketplace-connection`.

**Connection test (calls Noon — authorize first):**  
`POST /api/v1/channels/:channelId/marketplace-connection/test` → adapter `whoami`. Updates `lastTestAt`, `lastTestOutcome`, `lastTestError` on the connection row.

## Step 4 — Webhook ingress (before Noon Event Notification registration)

| Item | Detail |
| ---- | ------ |
| Route | `POST /api/v1/inbound/marketplace-webhooks/:ingressToken` |
| Token format | Path segment length 16–128 (`ingressTokenParamsSchema`) |
| Storage | SHA-256 hash in `marketplace_connections.webhook_ingress_token_hash` |
| Public auth | None; token resolves tenant/channel/marketplace |
| Noon adapter | Accepts `FBPI::ORDER_SYNC`; requires `metadata.message_id`, `payload.order_nr`, `event_schema_version: 1` |

**Gap (ADR-031):** Connection upsert does **not** yet issue or return an ingress token. Integration tests set the hash via `PostgresMarketplaceConnectionRepository.updateWebhookIngressTokenHash` after upsert. Plan a supported operator path (future API or runbook-approved admin procedure) before registering the URL in Noon.

**HTTPS:** Noon must reach a **public** Wasl base URL; localhost is insufficient unless tunneled.

**Workers:** Webhook HTTP enqueues `marketplace-order-lifecycle`; worker must consume `PROCESS_MARKETPLACE_LIFECYCLE` jobs (`docs/marketplaces/webhook-ingestion.md`).

## Step 5 — Catalog sync (existing Seller Lab SKU only)

Adapter registration: `registerMarketplaceCatalogAdapters` registers `NoonCatalogAdapter` under key **`noon`**.

Worker resolves runtime via `MarketplaceAdapterRuntimeFactory.createForSync` (active connection required; `marketplace_key` must match channel marketplace).

Before any sync job can succeed:

1. Channel marketplace key = `noon`.
2. Active marketplace connection with valid Noon credentials/configuration.
3. **Active offer** on `(product, channel)` with non-empty **`offers.externalReference`** = Noon `partner_sku` (Seller Lab SKU).
4. Stock at channel `defaultStockLocationId` (or resolved location per ADR-022).
5. Effective **price** for offer currency when activating/syncing price.
6. Worker running (`channel-catalog-sync` queue).

Wasl **does not** create Noon catalog (`syncProduct` unsupported). Verify listing in **Noon Seller Lab** / offer API after sync jobs, not from Wasl publish alone.

Integration reference: `tests/integration/noon-catalog-sync-mappings.test.js` (uses `configuration: { countryCode: 'ae', warehouseCode: 'WH-1' }` and credential shape with test RSA key).

## Step 6 — Stock Connect alignment (separate from Noon channel)

Local bootstrap (`scripts/dev-stockconnect-env-bootstrap.mjs`) creates generic `sc_mp_*` marketplaces only. For live Noon, point Stock Connect at the **Noon channel UUID** and tenant after steps 1–2; keep `COMMERCE_PROVIDER=wasl`. Order poll remains `GET /api/v2/stock-connect/orders` over Wasl-persisted orders (post-webhook ingest), not direct Noon polling.

## Network reachability

Do not call Noon login/whoami until authorized. When allowed, use connection test endpoint only. Optional pre-check: DNS/TCP to `noon-api-gateway.noon.partners:443` from the Wasl host (infrastructure only, not a credential test).
