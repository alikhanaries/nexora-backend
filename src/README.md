# Source Code Layout

```
src/
├── app/              Nest composition root (entry, modules wiring, DI, guards, config, HTTP)
├── modules/          Business features (MVC) + erp/<name> adapters
├── infrastructure/   Postgres, Redis, BullMQ, S3, observability adapters
├── workers/          Background worker process entry + handlers
├── shared/           Cross-cutting utilities (errors, validation, metrics, …)
├── common/           Alias docs → prefer `shared/`
└── config/           Stage-1 config facade → `app/config` + naming
```

## `src/app/`

| File / folder | Role |
| ------------- | ---- |
| `main.js` | API process entry |
| `create-application.js` | Wire modules + Nest HTTP server |
| `create-infrastructure.js` | Postgres, Redis, queue, outbox, … |
| `http/` | Nest app factory, Express middleware, HTTP server helper |
| `common/` | Guards, filters, Nest logger |
| `di/` / `database/` / `config/` | Nest DI tokens, DB module, config |

## Modules (MVC)

See [modules/README.md](modules/README.md).

## Dependency flow

```
app / workers ──► modules ──► shared
           └──► infrastructure ──► shared
```

Run `npm run arch:check` to verify boundaries.
