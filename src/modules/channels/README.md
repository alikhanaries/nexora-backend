# Channels module

Tenant-owned sales channels linked to global marketplace definitions. The `channels` table is tenant-scoped with row-level security enforced via `database.execute({ tenantId })`.

## Lifecycle

```
ACTIVE ──deactivate──▶ INACTIVE ──activate──▶ ACTIVE
   │
   └──────suspend────────────────────────────▶ SUSPENDED
         ▲                                      │
         └──────────────activate────────────────┘
```

| Current status | Allowed transitions     |
| -------------- | ----------------------- |
| `ACTIVE`       | `INACTIVE`, `SUSPENDED` |
| `INACTIVE`     | `ACTIVE`                |
| `SUSPENDED`    | `ACTIVE`                |

Rules enforced in the domain entity (`Channel.activate`, `Channel.deactivate`, `Channel.suspend`):

- Invalid transitions throw `BusinessRuleError` (HTTP 422).
- New channels are always created in `ACTIVE` status.
- `verifyChannelUsable` requires `ACTIVE` status.

## Authorization

| Action             | Permission        |
| ------------------ | ----------------- |
| List / get         | `channels.read`   |
| Create             | `channels.create` |
| Update / lifecycle | `channels.update` |

`tenantId` is always taken from `requireActorContext()` — never from the request body.

## HTTP API

| Method  | Path                          | Use case                                                                  |
| ------- | ----------------------------- | ------------------------------------------------------------------------- |
| `GET`   | `/api/v1/channels`            | `ListChannels`                                                            |
| `POST`  | `/api/v1/channels`            | `CreateChannel`                                                           |
| `GET`   | `/api/v1/channels/:channelId` | `GetChannel`                                                              |
| `PATCH` | `/api/v1/channels/:channelId` | `UpdateChannel`, `ActivateChannel`, `DeactivateChannel`, `SuspendChannel` |

## Cross-module query service

Other modules import the query service from the public API:

```typescript
import { DefaultChannelQueryService, type ChannelQueryService } from '../channels/public/index.js';
```

Available methods:

- `getChannelById(tenantId, channelId, tx?)`
- `listChannels(tenantId, filters, tx?)`
- `verifyChannelBelongsToTenant(tenantId, channelId, tx?)`
- `verifyChannelUsable(tenantId, channelId, tx?)`

Channel creation verifies marketplace existence via `VerifyMarketplaceExists` from the marketplaces public API.

### Channel ingest stock location (OQ-7-07)

`defaultStockLocationId` (optional UUID FK to `stock_locations`) is the preferred configuration for channel order ingest stock allocation. When unset, compatibility falls back to storing the stock location UUID in `configurationReference` (Phase 7 convention). Updates validate the location via public `InventoryService.verifyUsableStockLocation`.

## Integration events

| Event type               | When                   |
| ------------------------ | ---------------------- |
| `channel.created`        | After create           |
| `channel.updated`        | After field update     |
| `channel.status_changed` | After lifecycle change |

Lifecycle changes also emit audit events (`CHANNEL_STATUS_CHANGED`).

## Persistence

Migration `0013_channels.sql` defines the `channels` table with RLS; `0043_channels_default_stock_location.sql` adds `default_stock_location_id`. The PostgreSQL adapter lives in `infrastructure/postgres-channel-repository.js`.
