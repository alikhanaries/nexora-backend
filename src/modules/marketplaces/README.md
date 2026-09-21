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
