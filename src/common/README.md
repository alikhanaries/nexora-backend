# Common layer (alias)

Target MVC layout uses `src/common/` for cross-cutting utilities. In this repository that role is filled by **`src/shared/`** plus small HTTP helpers under `src/app/http/`.

| Target path | Use today |
|-------------|-----------|
| `common/errors/` | `src/shared/errors/` |
| `common/validation/` | `src/shared/validation/` |
| `common/logging/` | `src/shared/logging/` |
| `common/http/` | `src/shared/http/` (includes `express-inject.js`) |
| `common/security/` | `src/shared/security/` |

New reusable functions belong in the appropriate `shared/` submodule with tests under `tests/unit/shared/` or feature tests.

Do not duplicate helpers into `src/common/` until a file move is scheduled in `docs/architecture/function-based-mvc-migration.md`.
