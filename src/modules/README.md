# Business Modules (MVC)

`src/modules/` holds **bounded contexts** — orders, products, commerce integrations, inventory, etc.

## Canonical module structure (MVC)

Each module is a self-contained vertical slice:

```
src/modules/<module-name>/
├── models/              Entities, value objects, domain rules
├── services/            Use cases / application workflows
├── repositories/        Postgres repositories + module adapters
├── views/               HTTP mappers, Zod schemas, DTO helpers
├── controllers/nest/    NestJS module / controller / service (HTTP)
├── public/              Cross-module contracts
├── <feature>/           Optional nested feature slice (same MVC layers)
└── index.js             create<Module>Module composition root
```

### Owned feature slices (do not create sibling top-level modules)

| Concern | Location |
| ------- | -------- |
| Marketplace order ingestion / lifecycle | `orders/marketplace-ingestion/` |
| Marketplace inbound webhooks | `webhooks/marketplace/` |
| Merchant outbound webhooks (subscriptions / delivery) | `webhooks/outbound/` |
| ERP adapters (StockConnect, future ERPs) | `erp/<erp-name>/` |

See [erp/README.md](erp/README.md).

### Mapping from the old layered names

| Old | MVC |
| ------------ | --- |
| `domain/` | `models/` |
| `application/` | `services/` |
| `infrastructure/` | `repositories/` |
| `presentation/` | `views/` (+ Nest under `controllers/nest/`) |

Do **not** add new code under `domain/`, `application/`, `infrastructure/`, or `presentation/`.

## Nest HTTP surface

Feature Nest modules live under each business module’s `controllers/nest/` (auth → `identity`, Merchant/CE adapters → `compatibility`, StockConnect → `erp/stock-connect`, health → `health`, etc.).

`src/app/` is the composition root (`main.js`, `app.module.js`, shared guards/filters, config DI module, database module, DI tokens). Import feature Nest modules from there — do not add feature controllers under `src/app/`.

## Layer rules (enforced)

| From | May import |
| ---- | ---------- |
| `models/` | `shared/` only |
| `services/` | Own `models/`, `shared/`, other modules’ **public** API |
| `repositories/` | Own `models/`, `shared/`, `src/infrastructure/*` |
| `views/` / `controllers/` | Own `services/`, `shared/` |
| `controllers/nest/` | Module use cases via `CORE_SERVICES` / public APIs — no repository imports |

Run `npm run arch:check` after structural changes.

## Related

- [docs/architecture/function-based-mvc-migration.md](../../docs/architecture/function-based-mvc-migration.md)
- [docs/architecture/module-boundaries.md](../../docs/architecture/module-boundaries.md)
- [docs/decisions/ADR-001-modular-monolith.md](../../docs/decisions/ADR-001-modular-monolith.md)
