# Marketplaces module

Global marketplace definitions for Nexora. Marketplaces are platform-level records — the `marketplaces` table is **not** tenant-scoped and has no row-level security policy.

## Lifecycle

```
ACTIVE ──deactivate──▶ INACTIVE ──activate──▶ ACTIVE
```

| Current status | Allowed transitions |
| -------------- | ------------------- |
| `ACTIVE`       | `INACTIVE`          |
| `INACTIVE`     | `ACTIVE`            |

Rules enforced in the domain entity (`Marketplace.activate`, `Marketplace.deactivate`):

- Invalid transitions throw `BusinessRuleError` (HTTP 422).
- New marketplaces are always created in `ACTIVE` status.

## Key rules

Keys are normalised with `normalizeMarketplaceKey` (trim + lowercase) and validated with `validateMarketplaceKey` before persistence. The database enforces the same format via check constraints (`^[a-z][a-z0-9_]*$`).

## Authorization

| Action          | Permission            | Fallback       |
| --------------- | --------------------- | -------------- |
| List / get      | `marketplaces.read`   | `tenant.admin` |
| Create / update | `marketplaces.manage` | `tenant.admin` |

## Marketplace connections (Phase 21)

Tenant-scoped credentials live in `marketplace_connections` (encrypted at rest). Manage them through generic channel routes — never provider-specific connect URLs:

| Method   | Path                                                      |
| -------- | --------------------------------------------------------- |
| `POST`   | `/api/v1/channels/:channelId/marketplace-connection`      |
| `GET`    | `/api/v1/channels/:channelId/marketplace-connection`      |
| `PATCH`  | `/api/v1/channels/:channelId/marketplace-connection`      |
| `DELETE` | `/api/v1/channels/:channelId/marketplace-connection`      |
| `POST`   | `/api/v1/channels/:channelId/marketplace-connection/test` |

Requires `channels.read` / `channels.update`. Responses never include ciphertext or secrets.

Catalog adapters live under `infrastructure/adapters/{shopify,amazon,noon,namshi}/` and register on `MarketplaceCatalogAdapterRegistry`. **Shopify** is production-complete (Phase 23); see [infrastructure/adapters/shopify/README.md](infrastructure/adapters/shopify/README.md). Amazon, Noon, and Namshi remain partial stubs. See [ADR-029](../../docs/decisions/ADR-029-marketplace-connector-framework.md).

## Entity mappings (Phase 22)

Outbound sync may persist Nexora ↔ marketplace identifiers in `marketplace_entity_mappings` via `MarketplaceEntityMappingService` / `DefaultMarketplaceEntityMappingRecorder`. Adapters return optional mapping hints from sync methods; `channel-catalog-sync` applies them through the `MarketplaceEntityMappingRecorder` port only.

Connection test outcomes (`lastTestAt`, `lastTestOutcome`, `lastTestError`) are stored on `marketplace_connections` (migration `0046`); errors are sanitized before persistence. Audit events: `MARKETPLACE_CONNECTION_*`. See [ADR-030](../../docs/decisions/ADR-030-marketplace-connection-entity-mapping.md).

## HTTP API

| Method  | Path                       | Use case                                                            |
| ------- | -------------------------- | ------------------------------------------------------------------- |
| `GET`   | `/api/v1/marketplaces`     | `ListMarketplaces`                                                  |
| `POST`  | `/api/v1/marketplaces`     | `CreateMarketplace`                                                 |
| `GET`   | `/api/v1/marketplaces/:id` | `GetMarketplace`                                                    |
| `PATCH` | `/api/v1/marketplaces/:id` | `UpdateMarketplace`, `ActivateMarketplace`, `DeactivateMarketplace` |

Status changes via `PATCH` body (`status`) delegate to lifecycle use cases and emit audit + outbox events.

## Integration events

| Event type                   | When                      |
| ---------------------------- | ------------------------- |
| `marketplace.created`        | After create              |
| `marketplace.updated`        | After name change         |
| `marketplace.status_changed` | After activate/deactivate |

## Cross-module usage

Import use cases from the public API only:

```typescript
import { GetMarketplace } from '../marketplaces/public/index.js';
```

Do not import `PostgresMarketplaceRepository` or route plugins from other modules.

## Persistence

Migration `0012_marketplaces.sql` defines the `marketplaces` table. The PostgreSQL adapter lives in `infrastructure/postgres-marketplace-repository.ts`.
