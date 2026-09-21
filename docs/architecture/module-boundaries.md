# Module Boundaries

Nexora enforces architecture boundaries with **dependency-cruiser** (`.dependency-cruiser.cjs`). Violations fail CI via `npm run arch:check`.

Business modules do not exist yet, but rules are already active so the first module added cannot introduce layering debt.

## Layer model

Each business module under `src/modules/<name>/` follows four layers:

| Layer              | Path              | May depend on                                            |
| ------------------ | ----------------- | -------------------------------------------------------- |
| **Domain**         | `domain/`         | `shared/` only                                           |
| **Application**    | `application/`    | Own `domain/`, `shared/`                                 |
| **Infrastructure** | `infrastructure/` | Own `domain/`, `shared/`, `src/infrastructure/` adapters |
| **Presentation**   | `presentation/`   | Own `application/`, `shared/`                            |

### Domain purity

Domain code must **not**:

- Import from `src/infrastructure/` or `src/app/`
- Import Fastify, `pg`, `ioredis`, BullMQ, AWS SDK, Pino, Zod, or OpenTelemetry
- Reach into its own module's `infrastructure/` or `presentation/`

Domain expresses business rules as plain TypeScript with no I/O.

### Application layer

Use cases orchestrate domain objects and call ports defined in `shared/`. Application code must not import `presentation/` (HTTP details stay at the edge).

### Cross-module integration

Modules communicate through **public interfaces** exported from the module root — never by importing another module's `domain/`, `infrastructure/`, or `presentation/` internals.

```
✅  modules/orders/application/create-order.ts
    → modules/inventory/public/get-stock.ts

❌  modules/orders/application/create-order.ts
    → modules/inventory/infrastructure/stock-repository.ts
```

### ChannelEngine compatibility module

When added, `src/modules/channelengine-compatibility/` is a **facade** that translates ChannelEngine request/response shapes to native application interfaces. It must **never** touch PostgreSQL repositories or `src/infrastructure/postgres/` directly.

## Shared and infrastructure rules

| Rule                                                                              | Rationale                                    |
| --------------------------------------------------------------------------------- | -------------------------------------------- |
| `shared/` must not depend on `app/`, `infrastructure/`, `modules/`, or `workers/` | Keeps ports reusable and testable            |
| `infrastructure/` must not depend on `modules/` or `app/`                         | Adapters implement ports, not business logic |
| No circular dependencies                                                          | Prevents extraction and reasoning failures   |
| No devDependencies in `src/`                                                      | Runtime code stays lean                      |
| No deprecated Node core modules                                                   | Security and maintainability                 |

## Executable enforcement

```bash
npm run arch:check
```

Rules of note (see config for full list):

- `domain-no-infrastructure-layer`
- `domain-no-infrastructure-packages`
- `no-cross-module-internals`
- `compatibility-no-direct-persistence`
- `shared-stays-generic`
- `infrastructure-no-modules`

## Adding a new module checklist

1. Create `src/modules/<name>/{domain,application,infrastructure,presentation}/`.
2. Export public API from `src/modules/<name>/index.ts` (or `public/` folder).
3. Register presentation routes in `src/app/http/create-server.ts`.
4. Add SQL migrations under `src/infrastructure/postgres/migrations/`.
5. Run `npm run arch:check` — fix any boundary violations before merging.

## Module folder reference

See [src/modules/README.md](../../src/modules/README.md) for naming conventions and file placement examples.
