# Products module

Tenant-owned product catalog for Nexora. Products and localized content are scoped by `tenant_id` with PostgreSQL row-level security (migration `0014_products.sql`).

## Lifecycle

```
ACTIVE ──deactivate──▶ INACTIVE ──archive──▶ ARCHIVED
   │                      │
   └────────archive───────┴────────archive──▶ ARCHIVED (terminal)
```

| Current status | Allowed transitions    |
| -------------- | ---------------------- |
| `ACTIVE`       | `INACTIVE`, `ARCHIVED` |
| `INACTIVE`     | `ARCHIVED`             |
| `ARCHIVED`     | _(none — terminal)_    |

Rules enforced in the domain entity (`Product.deactivate`, `Product.archive`, `Product.update`):

- Invalid transitions throw `BusinessRuleError` (HTTP 422).
- Archived products cannot be updated.
- Physical deletion is prohibited; use `archive` to retire a product.

## Merchant SKU

`merchant_sku` is normalized with trim only — casing is preserved. Uniqueness is tenant-scoped via `UNIQUE (tenant_id, merchant_sku)`.

## HTTP API

| Method  | Path                                          | Permission        | Use case               |
| ------- | --------------------------------------------- | ----------------- | ---------------------- |
| `GET`   | `/api/v1/products`                            | `products.read`   | `ListProducts`         |
| `POST`  | `/api/v1/products`                            | `products.create` | `CreateProduct`        |
| `GET`   | `/api/v1/products/:productId`                 | `products.read`   | `GetProduct`           |
| `PATCH` | `/api/v1/products/:productId`                 | `products.update` | `UpdateProduct`        |
| `POST`  | `/api/v1/products/:productId/deactivate`      | `products.update` | `DeactivateProduct`    |
| `POST`  | `/api/v1/products/:productId/archive`         | `products.update` | `ArchiveProduct`       |
| `GET`   | `/api/v1/products/:productId/content`         | `products.read`   | `GetProductContent`    |
| `PUT`   | `/api/v1/products/:productId/content/:locale` | `products.update` | `UpsertProductContent` |

List endpoints use cursor pagination (`limit`, `cursor`, optional `status` filter). Sort order is `created_at DESC, id DESC`.

## Cross-module public contract

Import the query service from the public API only:

```typescript
import {
  DefaultProductQueryService,
  type ProductQueryService,
  type ProductDto,
} from '../products/public/index.js';
```

### `ProductQueryService`

Read-only, tenant-scoped lookups for downstream modules (inventory, pricing, offers, orders).

| Method                                                   | Inputs                | Output               | Not found           |
| -------------------------------------------------------- | --------------------- | -------------------- | ------------------- |
| `getProductById(tenantId, productId, tx?)`               | Tenant + product UUID | `ProductDto \| null` | `null`              |
| `getProductBySku(tenantId, merchantSku, tx?)`            | Tenant + trimmed SKU  | `ProductDto \| null` | `null`              |
| `getProductsByIds(tenantId, productIds, tx?)`            | Tenant + UUID list    | `ProductDto[]`       | Missing ids omitted |
| `verifyProductBelongsToTenant(tenantId, productId, tx?)` | Tenant + product UUID | `boolean`            | `false`             |

**Transaction behavior:** When `tx` is provided, reads use the caller's transaction (same snapshot / RLS context). When omitted, reads run on the shared database connection without an explicit tenant transaction — callers performing writes should pass their active `tx`.

**Authorization:** The query service does not enforce permissions; it is for internal module use inside already-authorized workflows.

**DTO stability:** `ProductDto` fields mirror the domain model (`id`, `tenantId`, `merchantSku`, `externalReference`, `productType`, `status`, timestamps). These are not database row types.

## Integration events

Written to the outbox in the same transaction as the mutation:

| Event type               | When                  |
| ------------------------ | --------------------- |
| `product.created`        | Product created       |
| `product.updated`        | Fields changed        |
| `product.status_changed` | Deactivate or archive |

## Audit events

| Audit type                 | When                  |
| -------------------------- | --------------------- |
| `PRODUCT_CREATED`          | Product created       |
| `PRODUCT_UPDATED`          | Fields changed        |
| `PRODUCT_STATUS_CHANGED`   | Deactivate or archive |
| `PRODUCT_CONTENT_UPSERTED` | Content upserted      |

## Persistence

Repositories live in `infrastructure/` and accept `Queryable` / `Transaction` ports from `shared/persistence`. Do not import repositories from other modules.
