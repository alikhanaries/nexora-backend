# ADR-029: Marketplace Connector Framework (Phase 21)

**Status:** Accepted  
**Date:** 2026-09-24  
**Phase:** 21 — generic marketplace connections + catalog outbound adapters

## 1. Context

Phases 16–20 delivered Nexora-side catalog synchronization ([ADR-028](ADR-028-phase-15-catalog-sync-architecture.md)): integration events → `channel-catalog-sync` queue → `MarketplaceCatalogAdapter` port with a **foundation stub** only.

Production operation requires **tenant-scoped marketplace connections**, encrypted credentials, provider-specific HTTP clients, and real adapters — without coupling core commerce modules to Shopify, Amazon, Noon, or Namshi.

## 2. Goals

- Generic **marketplace catalog adapter** architecture (register by `marketplaces.key`)
- **Multiple providers** (initial: `shopify`, `amazon`, `noon`, `namshi`) behind one port
- **Encrypted connection credentials** at rest (reuse `SecretEncryptorPort`)
- **Capability discovery** per adapter (`getCapabilities()`)
- **Provider-specific HTTP** isolated under `marketplaces/infrastructure/adapters/`
- **Normalized marketplace errors** mapped to existing catalog sync retry/permanent semantics
- **Provider rate limits** handled inside adapters (respect `Retry-After`); Nexora `catalog-sync` rate limit unchanged
- **Tenant isolation** + RLS on connection and entity mapping tables
- **Idempotent sync** via Nexora job coalescing + provider upsert/patch semantics where verified
- **Extensibility:** marketplace #N = new adapter + registration + contract tests

## 3. Non-goals (Phase 21)

- Marketplace order ingestion, fulfillment, returns, cancellations
- Marketplace webhooks (inbound)
- Inbound catalog import / full drift reconciliation against marketplace reads
- Product content/media sync to marketplaces
- Per-provider env vars for tenant credentials (`SHOPIFY_TOKEN`, etc.)
- Integer product IDs in `/api/v2` (ADR-021 scope unchanged)

## 4. Architecture

```text
Core mutation → outbox → integration-events → channel-catalog-sync (unchanged)
    → ExecuteCatalogSyncJob
    → MarketplaceCatalogAdapterRegistry (composition root registration)
    → Bound adapter session (decrypted connection, no secrets in jobs)
    → Provider adapter (shopify | amazon | noon | namshi | stub)
```

- **Adapter implementations** live in `src/modules/marketplaces/infrastructure/adapters/`.
- **Port types** remain in `channel-catalog-sync/public` (orchestration owns the sync contract).
- **Connection persistence** in `marketplaces` module: `marketplace_connections`, `marketplace_entity_mappings`.
- **Core modules** MUST NOT branch on `marketplace.key`.

## 5. Connection model

| Field | Notes |
| ----- | ----- |
| `tenant_id`, `channel_id`, `marketplace_key` | Scoped; unique active connection per triple |
| `credentials_ciphertext` | AES-GCM via existing encryptor |
| `configuration` | JSONB (e.g. Shopify `locationId`, Amazon `marketplaceId`, `region`) |
| `status` | `ACTIVE` / `DISABLED` |

HTTP API (generic, not provider-specific paths):

- `POST/GET/PATCH/DELETE /api/v1/channels/:channelId/marketplace-connection`
- `POST /api/v1/channels/:channelId/marketplace-connection/test`

## 6. Entity mapping

Table `marketplace_entity_mappings` stores provider string IDs (e.g. Shopify GIDs) keyed by `(tenant, channel, marketplace_key, nexora entity)`. Separate from `external_integer_id_mappings` (compat_v2 integers).

## 7. Provider verification (Phase 21)

| Provider | Verified API surface | Notes |
| -------- | ------------------- | ----- |
| **Shopify** | Admin GraphQL — **Phase 23 complete**: connection test, product/offer sync (SKU + publish via product status), inventory, price, entity mapping hints | [Shopify Admin GraphQL](https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventorySetQuantities) |
| **Amazon** | SP-API **Phase 24 complete**: LWA + AWS SigV4, marketplace participations test, Listings Items PATCH (inventory, price, deactivate via quantity 0) | [Amazon SP-API docs](https://developer-docs.amazon.com/sp-api/docs/partially-update-a-listing) |
| **Noon** | — | Public seller API contract not verified in-repo; adapter returns `MarketplaceUnsupportedError` / configuration guidance |
| **Namshi** | — | Public partner API contract not verified in-repo; same as Noon |

## 8. Phase 27 hardening (summary)

- Connection `configuration.apiBaseUrl` / `lwaTokenUrl` validated with shared outbound HTTPS SSRF checks before persistence.
- Connection test failures return sanitized messages to API callers; secrets redacted in stored test metadata.
- Catalog sync job boundary maps adapter permanent/retry errors and mapping conflicts to non-retrying outcomes.
- Auth token/session caches include endpoint/base URL in cache keys where applicable.

Full capability matrix: [capability-matrix.md](../marketplaces/capability-matrix.md).

## 9. Error normalization

Marketplace layer errors (`MarketplaceAuthenticationError`, `MarketplaceRateLimitError`, `MarketplaceTransientError`, …) map to `MarketplaceCatalogAdapterRetryError` / `MarketplaceCatalogAdapterPermanentError` at the adapter boundary.

## 10. Observability

Extend catalog sync metrics with bounded `marketplace` label (provider key only). Never label by product/tenant/token.

## 11. Phase 28 inbound orders (summary)

- Generic module `marketplace-order-ingestion`: normalized order schema, `MarketplaceOrderIngestionService`, optional `MarketplaceOrderAdapter` registry.
- Persists via existing `CreateChannelOrder` and `(tenant, channel, external_order_reference)` uniqueness — no new order tables.
- Provider adapters (Shopify, Amazon, Noon, Namshi) do not implement order fetch in Phase 28; catalog adapters unchanged.

See [order-ingestion.md](../marketplaces/order-ingestion.md).

## 12. Related

- [ADR-028](ADR-028-phase-15-catalog-sync-architecture.md)
- [platform-independence.md](../architecture/platform-independence.md)
- [module-boundaries.md](../architecture/module-boundaries.md)
