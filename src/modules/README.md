# Business Modules

`src/modules/` holds **bounded contexts** — orders, products, channels, inventory, etc. The folder is **empty in Phase 1**; this document defines conventions for Phase 2+.

## Module structure

Each module is a self-contained vertical slice:

```
src/modules/<module-name>/
├── domain/           Entities, value objects, domain services — pure TS
├── application/      Use cases, command/query handlers
├── infrastructure/   Module-specific repos, adapters (may use src/infrastructure)
├── presentation/     Fastify route plugins for /api/v1
├── public/           Exported interfaces for other modules (optional)
└── index.ts          Public module API surface
```

### Naming

- Module folder: lowercase, hyphenated (`compatibility`, `stock-reservations`)
- Use case files: verb-noun (`create-order.ts`, `list-products.ts`)
- Domain types: PascalCase (`Order`, `ProductSku`)

## Layer rules (enforced)

| From              | May import                                              |
| ----------------- | ------------------------------------------------------- |
| `domain/`         | `shared/` only                                          |
| `application/`    | Own `domain/`, `shared/`, other modules' **public** API |
| `infrastructure/` | Own `domain/`, `shared/`, `src/infrastructure/*`        |
| `presentation/`   | Own `application/`, `shared/`                           |

Run `npm run arch:check` after every module change.

## Cross-module communication

**Allowed:**

```typescript
import { getAvailableStock } from '../inventory/public/stock-queries.js';
```

**Forbidden:**

```typescript
import { StockRepository } from '../inventory/infrastructure/stock-repository.js';
```

Prefer integration events (outbox) for async cross-module reactions; synchronous calls only when read consistency requires it.

## HTTP routes

- Native routes: register under `/api/v1/<resource>` in module `presentation/`
- Register plugin in `src/app/http/create-server.ts`
- Use Zod schemas for OpenAPI generation

Merchant-compatible external API routes belong in the provider-neutral `compatibility` module under `/api/v2` — not in core domain modules. Native Nexora routes stay under `/api/v1`.

## Persistence

- Module-specific SQL in new migration files
- Repositories in `modules/<name>/infrastructure/` using `PostgresDatabase`
- Set tenant GUC at transaction start once auth exists

## Testing

- Unit tests: domain and application layers with mocked ports
- Integration tests: `tests/integration/<module>.test.ts` against Docker services

## First modules (planned)

Order of implementation to be confirmed in Phase 2 planning:

1. **Products** — catalog foundation
2. **Inventory** — stock levels
3. **Orders** — order lifecycle
4. **Channels** — marketplace connections
5. **compatibility** — Merchant-compatible `/api/v2` adapter (parallel with domain modules; provider-neutral internally)

## Related

- [docs/architecture/module-boundaries.md](../../docs/architecture/module-boundaries.md)
- [docs/decisions/ADR-001-modular-monolith.md](../../docs/decisions/ADR-001-modular-monolith.md)
