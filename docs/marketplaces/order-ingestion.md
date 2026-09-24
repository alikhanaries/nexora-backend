# Marketplace order ingestion architecture (Phase 28 + Shopify Phase 29)

## Flow

```text
Marketplace Admin API / Webhook (future)
        ↓
Provider order adapter
        ↓
Normalized marketplace order
        ↓
MarketplaceOrderIngestionService
        ↓
CreateChannelOrder → Orders tables + outbox (order.created)
```

Core Orders remain marketplace-agnostic. Provider logic stays in adapters; ingestion is generic.

## Normalized contract

Defined in `normalized-marketplace-order.schema.js`. Derived from existing channel ingest (`CreateChannelOrder`):

| Field | Purpose |
| ----- | ------- |
| `externalOrderId` | Canonical dedup key → `orders.external_order_reference` |
| `externalOrderNumber` | Optional display reference (not used for dedup) |
| `marketplaceKey` | Must match channel marketplace |
| `status` | Provider-neutral; only `pending` / `confirmed` / `unknown` ingest in Phase 28 |
| `currency`, totals | Maps to order money columns |
| `customer` | Immutable `CustomerSnapshot` |
| `lines` | SKU / offer / marketplace entity mapping resolution |

Line prices from the marketplace are informational; Nexora effective pricing applies at ingest (same as Channel API).

## Idempotency

- **Database:** unique index `orders_tenant_channel_external_ref_unique`
- **Application:** `CreateChannelOrder` equivalence check on replay
- **Concurrency:** insert race → unique violation → load existing row

Duplicate delivery returns `ingestionOutcome: duplicate` without a second order row.

## SKU resolution

1. `merchantSku` → tenant product SKU  
2. `channelProductNo` → offer external reference  
3. `marketplaceExternalEntity` → `marketplace_entity_mappings` (catalog sync mappings)

Missing mapping → permanent failure (`NotFoundError`), not silent wrong product association.

## Adapter contract

`MarketplaceOrderAdapter` (`marketplace-order-adapter.port.js`):

- `getOrderCapabilities()` — `supportsOrdersInbound`, webhook/poll flags
- `fetchOrder` — load one order by external id (requires channel `stockLocationId` on the fetch context)
- `listOrders` — cursor page of normalized orders (polling)
- `normalizeWebhookOrder` — future webhook phases

Webhook and polling entrypoints call `IngestNormalizedMarketplaceOrder` or `FetchAndIngestMarketplaceOrders`.

## Shopify order ingestion (Phase 29)

**Scope:** initial order create via Admin GraphQL only. No webhooks, updates, cancellations, returns, refunds, fulfillment, or shipment sync.

### API operations

| Operation | Shopify Admin GraphQL |
| --------- | --------------------- |
| Fetch one order | `order(id:)` query |
| Poll orders | `orders(first, after, query)` query with `pageInfo` cursor pagination |

Page size is clamped to Shopify’s documented `first` limit (1–250). Optional `query` uses Shopify’s [order search syntax](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders#argument-query).

### Connection and authentication

Reuses the existing Shopify marketplace connection (`shopDomain`, `accessToken`, optional `apiVersion`, `shopifyLocationId` for catalog). Order reads use the same encrypted credentials and `ShopifyGraphqlClient` as catalog sync.

**OAuth scopes:** Shopify apps must include permission to read orders (for example `read_orders` on custom apps, or the orders access scope appropriate to your app type). Nexora does not grant scopes automatically; configure them in the Shopify app / token used for the connection.

### Mapping

- **External id:** Shopify order GID (`gid://shopify/Order/...`) is stored as `externalOrderId` (numeric ids are normalized to GID for API calls).
- **Order number:** Shopify `name` (for example `#1001`) → `externalOrderNumber`.
- **Status:** From `cancelledAt`, `displayFinancialStatus`, and `displayFulfillmentStatus`. Cancelled / fulfilled orders are normalized but **skipped during polling**; single-order fetch still returns them and ingestion rejects non-ingestible statuses. Refunded / voided / expired financial states are permanent mapping errors.
- **Lines:** SKU → `merchantSku`; otherwise Shopify variant GID → `marketplaceExternalEntity` type `shopify_product_variant`.
- **Customer / addresses:** Mapped into the normalized customer snapshot (no extra Shopify customer storage).

### Polling

`FetchAndIngestMarketplaceOrders` loads pages through `listOrders`, skips non-ingestible statuses, and ingests each order via `IngestNormalizedMarketplaceOrder`. `maxPages` defaults to `1` to avoid unbounded loops; callers pass `after` to continue cursors.

No dedicated order-poll queue or cron is added in Phase 29; wire `wireMarketplaceOrderIngestion` registers the Shopify order adapter for workers or future jobs.

### Limitations

- Line items request `lineItems(first: 100)`; orders with more lines need a future pagination pass.
- Orders already fulfilled or cancelled are not created during poll.
- Lifecycle changes on Shopify after create are out of scope.

## Observability

Metric `marketplace_order_ingestion_total` labels: `outcome`, `marketplace`, `operation`. No PII or order IDs in labels.

## Deferred (later phases)

- Inbound webhook routes and signature verification
- Order update / cancel / fulfillment / shipment sync
- Scheduled order polling workers
