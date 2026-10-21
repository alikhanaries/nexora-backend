# Business Modules (MVC)

`src/modules/` holds **bounded contexts** — orders, products, commerce integrations, inventory, etc.

## Canonical function-based MVC

```
src/modules/<module-name>/
├── routes/              Endpoint registry only (method + path + handler key)
├── controllers/nest/    Thin Nest HTTP adapters (@Controller / @Module only)
├── services/            Business logic as createX(deps) → { execute } / method bags
├── repositories/        DB access as createXRepository() → { find, insert, … }
├── models/              Entities as plain data + pure functions
├── views/               HTTP Zod schemas + response mappers
├── public/              Cross-module contracts
└── index.js             create<Module>Module composition root
```

### Layer responsibilities

| Layer | Contains | Must not contain |
| ----- | -------- | ---------------- |
| `routes/` | HTTP method + path (+ public flag / handler name) | Business logic, SQL, workflows |
| `controllers/` | Parse → call service → HTTP envelope | Domain rules, SQL |
| `services/` | Application / business workflows (functions) | HTTP, SQL |
| `repositories/` | Queries, inserts, row Zod schemas | Business workflows, HTTP |
| `models/` | Entity shape + pure domain transitions | HTTP, SQL |
| `views/` | Request/response DTO schemas and mappers | Business rules, SQL |

### Functions, not classes

Prefer `createX` factories and plain functions.

**Nest-only exception:** `@Controller` / `@Module` classes (and Nest guards) required by NestJS. No business logic in those classes. Do **not** add Nest `*.service.js` adapters — controllers inject `CORE_SERVICES` and call module use cases.

**Other intentional exceptions (document when kept):** marketplace HTTP adapters with inheritance, error subclasses, thick compatibility/StockConnect Nest orchestration services pending dedicated extraction batches.

### Reference / migrated Nest adapters

| Module | Nest adapter | Services/repos factories |
| ------ | ------------ | ------------------------ |
| `tenants/` | Done | Done |
| `audit/` | Done | Done |
| `api-keys/` | Done | Done |
| `mfa/` | Done | Done |
| `authorization/` | Done | Done |
| `identity/` | Done (Nest) | Pending use-case/repo classes |
| `products/`, `pricing/`, `offers/`, `inventory/` | Done (Nest) | Pending |
| `orders/`, `cancellations/`, `shipments/`, `returns/` | Done (Nest) | Partial (many factories already) |
| `marketplaces/`, `commerce-integrations/` | Done (Nest) | Pending |
| `webhooks/outbound/` | Done (Nest) | Pending |
| `health/` | Done (routes + thin controller) | N/A |
| `compatibility/`, `erp/stock-connect/` | Nest services retained (thick orchestration) | Pending dedicated batch |
| `integration-catalog-sync/`, `external-id-mapping/`, `webhooks/marketplace/` | No Nest HTTP surface | Pending factory conversion |

## Owned feature slices

| Concern | Location |
| ------- | -------- |
| Marketplace order ingestion / lifecycle | `orders/marketplace-ingestion/` |
| Marketplace inbound webhooks | `webhooks/marketplace/` |
| Merchant outbound webhooks | `webhooks/outbound/` |
| ERP adapters | `erp/<erp-name>/` |

## Nest HTTP surface

Feature Nest modules live under each business module’s `controllers/nest/`.
`src/app/` is the composition root.

## Layer rules (enforced)

Run `npm run arch:check` and `tests/unit/architecture/module-routes-layout.test.js` after structural changes.

## Related

- [docs/architecture/function-based-mvc-migration.md](../../docs/architecture/function-based-mvc-migration.md)
- [docs/architecture/module-boundaries.md](../../docs/architecture/module-boundaries.md)
