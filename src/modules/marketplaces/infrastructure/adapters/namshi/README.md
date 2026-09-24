# Namshi marketplace catalog adapter (Phase 26)

Namshi seller integrations are documented on the [noon Partners API](https://noon-docs.noonpartners.dev) platform (shared gateway with noon). This adapter implements only **verified** Namshi-specific behavior; it does not reuse noon pricing endpoints.

## API source

Primary reference: [Step 2: Set Up Products and Inventory](https://noon-docs.noonpartners.dev/docs/fbpi/setup/product-inventory) (noon vs namshi pricing/stock tables) and related Authentication / Stock / Offer API pages on the same site.

## Supported capabilities

| Capability | Status | API |
| ---------- | ------ | --- |
| Connection test | **Supported** | `GET /identity/v1/whoami` after login |
| Inventory sync | **Supported** | `POST /stock/v1/stock-update` (absolute `qty`) |
| Price sync | **Supported** | `POST /pricing/v1/local/upsert` |
| Offer sync | **Supported** | `GET /offer/v1/product/{partner_sku}` (mappings) |
| Activation | **Supported** (partial) | No `is_active` flag — relist requires a subsequent **inventory sync** with `qty > 0`; `syncOffer` activate refreshes mappings only |
| Deactivation | **Supported** | `POST /stock/v1/stock-update` with `qty: 0` (documented Namshi delist semantics) |
| Product sync | **Unsupported** | Catalog must exist in Seller Lab / Content API first |

## Authentication

Same service-account model as noon Partners:

1. RS256 JWT (`sub` = key id, `iat`, `jti`)
2. `POST {apiBaseUrl}/identity/public/v1/api/login` with `{ token, default_project_code }`
3. Session cookies + mandatory `User-Agent` on later calls

Credentials (encrypted JSON): `keyId` / `key_id`, `privateKey` / `private_key`, `projectCode` / `project_code`.

## Configuration

| Field | Required | Description |
| ----- | -------- | ----------- |
| `configuration.countryCode` | yes | `ae`, `sa`, or `eg` |
| `configuration.warehouseCode` | yes | Warehouse for stock updates |
| `configuration.apiBaseUrl` | no | Default `https://noon-api-gateway.noon.partners` |
| `configuration.userAgent` | no | Default `Nexora/1.0` or deployment `NOON_USER_AGENT` |

Deployment defaults for the shared gateway may use `NOON_API_BASE_URL` and `NOON_USER_AGENT` (see root `.env.example`).

## Entity mappings

| Type | Source |
| ---- | ------ |
| `namshi_partner_sku` | `partner_sku` / offer external reference |
| `namshi_offer` | `offer_code` from GetProductOffers when present |
| `namshi_catalog_sku` | Catalog `sku` field when returned |

## Namshi vs noon (verified differences)

| Topic | noon | Namshi |
| ----- | ---- | ------ |
| Price write | `/pricing/v1/pricing/upsert` | `/pricing/v1/local/upsert` |
| Delist | `is_active: false` on pricing upsert | `qty: 0` on stock update |
| `is_active` on pricing | Supported | **Not supported** (per platform docs table) |

## Limitations

- **Product/catalog create** not implemented in Nexora.
- **MSRP** not synced on local pricing upsert (only `price` from effective Nexora amount).
- **Activate** does not push stock; run inventory sync to restock.
- **Async batch jobs / webhooks** not used; synchronous batch item statuses only.
- Separate Namshi-only public docs URL was not used; behavior is taken from noon Partners documentation where Namshi columns/examples are explicit.

## Errors and retries

Uses shared `MarketplaceHttpClient` and batch item status checks. HTTP 429 and 5xx follow the generic catalog-sync retry model.
