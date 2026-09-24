# Marketplace catalog capability matrix (Phases 23–26)

Authoritative summary of **implemented** adapter behavior. “Partial” means the generic Nexora operation maps to a subset of provider semantics — see provider READMEs.

| Capability | Shopify | Amazon | Noon | Namshi |
| ---------- | ------- | ------ | ---- | ------ |
| Connection test | Supported — Admin GraphQL `shop { name }` | Supported — SP-API marketplace participations | Supported — `GET /identity/v1/whoami` | Supported — same gateway whoami |
| Product sync | Supported — publish/status via product sync | Partial — mapping + availability; no full catalog create | **Unsupported** — catalog must exist in Seller Lab | **Unsupported** — same |
| Offer sync | Supported | Supported — listing PATCH / availability | Supported — GetProductOffers + pricing activation | Supported — GetProductOffers |
| Inventory sync | Supported — absolute quantity at location | Supported — fulfillment quantity PATCH | Supported — `POST /stock/v1/stock-update` absolute `qty` | Supported — same stock API |
| Price sync | Supported — GraphQL price | Supported — purchasable_offer PATCH | Supported — `POST /pricing/v1/pricing/upsert` | Supported — `POST /pricing/v1/local/upsert` |
| Activation | Supported — publish / active listing | Partial — availability via quantity when deactivating path | Supported — `is_active: true` on pricing upsert | **Partial** — mapping refresh only; relist requires inventory sync (`qty > 0`) |
| Deactivation | Supported — unpublish / inactive | Partial — quantity `0` (non-delete) | Supported — `is_active: false` on pricing upsert (stock unchanged) | Supported — stock `qty: 0` (not pricing flag) |

## Semantic differences (verified)

| Topic | Shopify | Amazon | Noon | Namshi |
| ----- | ------- | ------ | ---- | ------ |
| Auth | Admin access token | LWA + AWS SigV4 | RS256 JWT + cookie session | RS256 JWT + cookie session |
| Inventory | Location + inventory item GID | Seller SKU listing availability | `warehouse_code` + `partner_sku` | Same as Noon stock API |
| Price input | Nexora effective minor units | Decimal value_with_tax | Decimal `price` | Decimal `price` on **local** upsert |
| Delist | Unpublish / inactive | Qty 0 | `is_active: false` | Qty 0 |

## Entity mapping types

| Provider | External types |
| -------- | ---------------- |
| Shopify | `shopify_product`, `shopify_variant`, `shopify_inventory_item` (see adapter) |
| Amazon | `amazon_listing` |
| Noon | `noon_partner_sku`, `noon_offer`, `noon_catalog_sku` |
| Namshi | `namshi_partner_sku`, `namshi_offer`, `namshi_catalog_sku` |

Provider details: `src/modules/marketplaces/infrastructure/adapters/{shopify,amazon,noon,namshi}/README.md`.
