# Configuration layer

Wasl reads and validates environment variables in **one place**: `src/app/config/schema.js` → `loadConfig()` in `src/app/config/config.js`.

This folder is a **stable import path** for the function-based MVC migration. It re-exports validated config; it does not introduce a second schema.

| File | Role |
|------|------|
| `index.js` | `loadConfig`, `loadConfigFromEnvironment`, naming exports |
| `env.config.js` | `configSchema` re-export |
| `naming.config.js` | `WASL_NAMING` and compatibility registry re-export |

Canonical naming source file: `src/shared/config/wasl-naming.config.js`.

Do not read `process.env` outside `src/app/config/`.
