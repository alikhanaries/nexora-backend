# Pricing module

Tenant-scoped product prices stored in integer minor units with ISO 4217 currency codes. Migration `0016_pricing.sql` defines the `prices` table with row-level security.

## Effective price resolution

`getEffectivePrice` is deterministic:

1. Filter `ACTIVE` rows where `valid_from <= at` and (`valid_to` is null or `at < valid_to`).
2. Match `tenant_id`, `product_id`, and `currency`; include rows where `channel_id` equals the requested channel **or** is null (tenant-wide fallback).
3. Order by channel-specific rows first, then `valid_from DESC`.
4. Return the first match, or `null` when none apply.

Amount validation uses `shared/money` (`parseCurrency`, `parseAmountMinor`, `createMoney`).

## Authorization

| Action     | Permission       |
| ---------- | ---------------- |
| List / get | `pricing.read`   |
| Create     | `pricing.create` |
| Update     | `pricing.update` |

`tenantId` is always taken from `requireActorContext()`.

## HTTP API

| Method  | Path                      | Use case                         |
| ------- | ------------------------- | -------------------------------- |
| `GET`   | `/api/v1/prices`          | `ListPrices`                     |
| `POST`  | `/api/v1/prices`          | `CreatePrice`                    |
| `GET`   | `/api/v1/prices/:priceId` | `GetPrice`                       |
| `PATCH` | `/api/v1/prices/:priceId` | `UpdatePrice`, `DeactivatePrice` |

List endpoints use cursor pagination (`limit`, `cursor`) with optional filters: `productId`, `channelId`, `currency`, `status`.

## Cross-module public contract

```typescript
import {
  DefaultPricingService,
  type PricingService,
  type PriceDto,
} from '../pricing/public/index.js';
```

### `PricingService`

| Method                                                                  | Purpose                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `getEffectivePrice(tenantId, productId, channelId, currency, at?, tx?)` | Resolve effective price at a point in time                               |
| `createPrice(input, tx?)`                                               | Create a price row (validates product/channel via public query services) |
| `updatePrice(input, tx?)`                                               | Update amount, validity window, or channel scope                         |
| `deactivatePrice(input, tx?)`                                           | Set status to `INACTIVE`                                                 |
| `listPrices(input, tx?)`                                                | Cursor-paginated listing                                                 |

Depends on `ProductQueryService` and `ChannelQueryService` from their public interfaces only.

## Integration events

| Event type      | When                               |
| --------------- | ---------------------------------- |
| `price.created` | Price created                      |
| `price.updated` | Fields or status changed           |
| `price.changed` | Effective pricing may have changed |

## Audit events

| Audit type          | When              |
| ------------------- | ----------------- |
| `PRICE_CREATED`     | Price created     |
| `PRICE_UPDATED`     | Price updated     |
| `PRICE_DEACTIVATED` | Price deactivated |
