# Offers module

Tenant-owned sellable product representations on sales channels. Migration `0017_offers.sql` defines the `offers` table with a unique constraint on `(tenant_id, product_id, channel_id)`.

## Lifecycle

```
DRAFT ──activate──▶ ACTIVE ──suspend──▶ SUSPENDED
  │                    │                    │
  │                    └──deactivate────────┼──▶ INACTIVE
  └─────────────────────────────────────────┘
```

| Current status | Allowed transitions     |
| -------------- | ----------------------- |
| `DRAFT`        | `ACTIVE`                |
| `ACTIVE`       | `SUSPENDED`, `INACTIVE` |
| `SUSPENDED`    | `ACTIVE`, `INACTIVE`    |
| `INACTIVE`     | _(terminal)_            |

`ActivateOffer` validates:

- Product exists and is `ACTIVE` (`ProductQueryService`)
- Channel is usable (`ChannelQueryService.verifyChannelUsable`)
- Optional pricing resolution via `PricingService.getEffectivePrice` when `resolvePricing: true`

This module depends on products, channels, and pricing public interfaces only — not inventory.

## Authorization

| Action             | Permission      |
| ------------------ | --------------- |
| List / get         | `offers.read`   |
| Create             | `offers.create` |
| Update / lifecycle | `offers.update` |

`tenantId` is always taken from `requireActorContext()`.

## HTTP API

| Method  | Path                               | Use case                                                          |
| ------- | ---------------------------------- | ----------------------------------------------------------------- |
| `GET`   | `/api/v1/offers`                   | `ListOffers`                                                      |
| `POST`  | `/api/v1/offers`                   | `CreateOffer`                                                     |
| `GET`   | `/api/v1/offers/:offerId`          | `GetOffer`                                                        |
| `PATCH` | `/api/v1/offers/:offerId`          | `UpdateOffer`, `ActivateOffer`, `SuspendOffer`, `DeactivateOffer` |
| `POST`  | `/api/v1/offers/:offerId/activate` | `ActivateOffer` (with optional pricing resolution)                |

## Cross-module public contract

```typescript
import {
  DefaultOfferQueryService,
  type OfferQueryService,
  type OfferDto,
} from '../offers/public/index.js';
```

### `OfferQueryService`

| Method                                                              | Purpose                              |
| ------------------------------------------------------------------- | ------------------------------------ |
| `getOfferById(tenantId, offerId, tx?)`                              | Fetch offer or throw `NotFoundError` |
| `getOfferForProductAndChannel(tenantId, productId, channelId, tx?)` | Lookup by product + channel          |
| `getOffersByProduct(tenantId, productId, tx?)`                      | All offers for a product             |
| `verifyOfferUsable(tenantId, offerId, tx?)`                         | Requires `ACTIVE` status             |

## Integration events

| Event type             | When                 |
| ---------------------- | -------------------- |
| `offer.created`        | Offer created        |
| `offer.updated`        | Fields changed       |
| `offer.status_changed` | Lifecycle transition |

## Audit events

| Audit type             | When                 |
| ---------------------- | -------------------- |
| `OFFER_CREATED`        | Offer created        |
| `OFFER_UPDATED`        | Fields changed       |
| `OFFER_STATUS_CHANGED` | Lifecycle transition |
