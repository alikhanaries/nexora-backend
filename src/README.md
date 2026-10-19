# Source Code Layout

```
src/
├── nest/             NestJS bootstrap, auth, health, StockConnect, legacy compat
├── modules/          Business features (MVC: models / services / repositories / views / controllers)
├── app/              Config loaders, shared HTTP helpers, migration CLIs
├── infrastructure/   Postgres, Redis, BullMQ, S3, observability adapters
├── workers/          Background worker process entry + handlers
├── shared/           Cross-cutting utilities (errors, validation, metrics, …)
├── common/           Alias docs → prefer `shared/`
├── config/           Stage-1 config facade → `app/config` + naming
└── integrations/     StockConnect mappers (compatibility)
```

## Modules (MVC)

See [modules/README.md](modules/README.md). Each feature uses:

- `models/` — entities and rules  
- `services/` — use cases  
- `repositories/` — persistence / adapters  
- `views/` — schemas and mappers  
- `controllers/nest/` — Nest HTTP adapters  

## Nest vs modules

| Concern | Location |
| ------- | -------- |
| Process entry (`start:nest`) | `src/nest/bootstrap.mjs` |
| Feature HTTP (products, orders, …) | `src/modules/<feature>/controllers/nest/` |
| Auth guard, health, StockConnect | `src/nest/` |

## Dependency flow

```
nest / workers / app ──► modules ──► shared
                └──► infrastructure ──► shared
```

Run `npm run arch:check` to verify boundaries.
