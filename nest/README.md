# Deprecated Nest stub (root)

The active NestJS application lives under **`src/nest/`** (`npm run start:nest` → `src/nest/bootstrap.mjs`).

This root `nest/` folder is a **legacy stub** from an early migration experiment (Fastify adapter, health-only module). **Do not add new code here.**

## Evidence it is not the production entrypoint

| Active path | Legacy stub |
|-------------|-------------|
| `package.json` → `start:nest` → `src/nest/bootstrap.mjs` | Not referenced by npm scripts |
| Full API modules under `src/nest/*` | `nest/app.module.js` imports only `HealthModule` |
| Express platform | `@nestjs/platform-fastify` in `nest/main.js` |

## Retirement plan

1. Confirm no CI job or deployment manifest invokes `node nest/main.js` (grep repo + pipelines).
2. After one release with zero references, delete the root `nest/` directory.
3. Until then, configuration DI uses `WASL_CONFIG` in `nest/config/config.module.js`.

See [docs/migration-phase-2-nest-express.md](../docs/migration-phase-2-nest-express.md).
