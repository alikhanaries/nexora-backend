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

### Compatibility module (`/api/v2`)

`src/modules/compatibility/` is a **provider-neutral adapter** that exposes external compatibility APIs at `/api/v2`. Nexora core modules remain provider-neutral; external platform terminology must not leak into domain or application layers.

#### Three surfaces (do not conflate)

| Surface | Contract | Phase 5 initial scope |
| ------- | -------- | --------------------- |
| `/api/v1` | Nexora native | Active — core module presentation |
| `/api/v2` | **Merchant-compatible** | Order reads + acknowledgement (see [ADR-018](../decisions/ADR-018-phase-5-merchant-compatible-scope.md)) |
| Channel ingestion | **Channel API** (separate) | **Not** in Phase 5 initial scope — `POST /v2/orders` create exists on Channel API only |

The Merchant API does **not** define `POST /v2/orders` for order creation. Nexora must not invent hybrid semantics on `/api/v2/orders`.

```
external credential → authenticated principal → tenant context → core public contract
```

Dependency direction:

```
compatibility/presentation
    ↓
compatibility/application (mappers, error translation)
    ↓
core modules public/ contracts
    ↓
core modules (orders, products, inventory, …)
```

Rules:

| Rule | Meaning |
| ---- | ------- |
| **Core → compatibility forbidden** | Business modules must not import the compatibility module |
| **Compatibility → core public only** | Compatibility may call other modules only through `public/` contracts |
| **No direct persistence** | Compatibility must not touch PostgreSQL repositories or `src/infrastructure/postgres/` |
| **No duplicated business logic** | State machines and invariants stay in core modules |
| **Outbound via outbox** | Core modules never synchronously call external providers; integration uses outbox → BullMQ → handler → adapter |

Native Nexora API remains `/api/v1`. Do not mix v1 and v2 route registration.

### Platform independence

Nexora core must operate without any external commerce platform. See [platform-independence.md](platform-independence.md).

| Rule | Meaning |
| ---- | ------- |
| **Nexora owns business truth** | PostgreSQL + core modules — not an external platform |
| **No provider names in core** | No provider-specific types, services, or config in core modules |
| **Compatibility is optional** | Removing `src/modules/compatibility/` must not prevent core modules from functioning |
| **No external API for core paths** | Native `/api/v1` and compatibility adapters call Nexora public contracts only |
| **Documentation ≠ dependency** | External OpenAPI specs are reference material for contract design |

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
- `core-no-compatibility`
- `compatibility-no-direct-persistence`
- `compatibility-no-module-index-imports`
- `compatibility-public-contracts-only`
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
