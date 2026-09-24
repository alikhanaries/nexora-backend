# Shopify marketplace adapter (Phase 23)

Production reference implementation for `MarketplaceCatalogAdapter`. All Shopify-specific HTTP and GraphQL live in this folder; core commerce modules stay provider-neutral.

## Authentication

Tenant credentials are stored on `marketplace_connections` (encrypted):

| Credential field | Purpose |
| ---------------- | ------- |
| `shopDomain`     | Shop hostname (`example.myshopify.com` or bare handle `example`) |
| `accessToken`    | Shopify Admin API access token |

Optional connection `configuration`:

| Field | Purpose |
| ----- | ------- |
| `shopifyLocationId` | Shopify location GID or numeric id for `inventorySetQuantities` |
| `apiVersion` | Admin API version override (defaults to deployment `SHOPIFY_ADMIN_API_VERSION` or `2024-10`) |

## Capabilities

| Operation | Supported | Shopify API |
| --------- | --------- | ----------- |
| Connection test | Yes | GraphQL `shop { name }` |
| Product sync | Yes | `productVariantUpdate` (SKU), `productUpdate` (status) |
| Offer sync | Yes | Same as product sync + mapping hints |
| Inventory sync | Yes | `inventorySetQuantities` |
| Price sync | Yes | `productVariantUpdate` (price) |
| Activate | Yes | `productUpdate` status `ACTIVE` |
| Deactivate | Yes | `productUpdate` status `DRAFT` (not deletion) |

## Entity mappings

Adapter-defined external types (stored in `marketplace_entity_mappings`):

- `shopify_product` — Nexora product → Shopify product GID
- `shopify_product_variant` — Nexora offer → variant GID
- `shopify_inventory_item` — Nexora product → inventory item GID (from variant lookup)

Mapping hints are returned only after Shopify confirms identifiers in GraphQL responses.

## Limitations

- Nexora has no generic variant model. **`offer.externalReference` must hold the Shopify variant id** (numeric or GID) for outbound sync. The adapter does not create new Shopify products when that reference is missing.
- Product titles and rich content are not synced in Phase 23 because the catalog sync port does not expose localized product content.
- One variant per offer is assumed (1:1 with merchant SKU).

## Errors and retries

HTTP status and GraphQL `THROTTLED` map to the shared marketplace error types → catalog sync retry/permanent errors. Rate limits honor `Retry-After` when present.

See [ADR-029](../../../../../docs/decisions/ADR-029-marketplace-connector-framework.md) and [ADR-030](../../../../../docs/decisions/ADR-030-marketplace-connection-entity-mapping.md).
