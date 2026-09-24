# Amazon SP-API marketplace adapter (Phase 24)

Production adapter for `MarketplaceCatalogAdapter` using **Login with Amazon (LWA)** and **AWS Signature Version 4** against Selling Partner API.

## Credentials (encrypted on `marketplace_connections`)

| Field | Purpose |
| ----- | ------- |
| `clientId` | LWA application client identifier |
| `clientSecret` | LWA client secret |
| `refreshToken` | LWA refresh token |
| `sellerId` | Selling partner ID (merchant token) |
| `awsAccessKeyId` | IAM user access key for SP-API signing |
| `awsSecretAccessKey` | IAM secret key |
| `awsSessionToken` | Optional STS session token |

## Connection configuration

| Field | Purpose |
| ----- | ------- |
| `marketplaceId` | Amazon marketplace id (e.g. `ATVPDKIKX0DER`) — **required** |
| `region` | SP-API endpoint group: `na` (default), `eu`, `fe` |
| `awsRegion` | Optional override for SigV4 region (defaults from `region`) |
| `listingsProductType` | Listings Items `productType` (default `PRODUCT`) |
| `lwaTokenUrl` | Optional LWA token endpoint override |

Deployment may set `AMAZON_LWA_TOKEN_URL` in environment config (see `.env.example`).

## Capabilities

| Operation | Mechanism |
| --------- | --------- |
| Connection test | `GET /sellers/v1/marketplaceParticipations` (signed) |
| Inventory sync | Listings Items `PATCH` → `/attributes/fulfillment_availability` |
| Price sync | Listings Items `PATCH` → `/attributes/purchasable_offer` |
| Product / offer sync | Deactivate → quantity `0` on fulfillment availability (not delete) |
| Activate | Mapping hint only; inventory/price jobs supply quantities and offers |

## Entity mappings

- `amazon_listing` — Nexora product/offer → seller SKU (from `offer.externalReference` or `merchantSku`)

## Authentication architecture

- **LWA:** `AmazonLwaTokenProvider` (connection-scoped in-memory cache, SHA-256 cache key)
- **SigV4:** `AwsSigV4RequestSigner` (`execute-api` service) — reusable for other signed providers
- **Transport:** generic `MarketplaceHttpClient` (no Amazon branches)

## Limitations

- Does **not** create new Amazon catalog listings or ASINs — SKU must already exist in Seller Central / Listings API.
- No product title, browse node, variation theme, or attribute catalog sync (not on Nexora catalog sync port).
- Offer **activate** does not restore stock levels; run inventory sync after activation.
- Noon/Namshi are separate adapters.

See [ADR-029](../../../../../docs/decisions/ADR-029-marketplace-connector-framework.md).
