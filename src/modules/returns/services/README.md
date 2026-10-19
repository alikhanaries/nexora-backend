# Returns module — physical MVC layout (Phase 4.9)

| Folder | Responsibility |
|--------|----------------|
| `models/` | `Return`, lines, status transitions |
| `services/` | Create/acknowledge/receive/complete lifecycle, command/query services |
| `services/ports/` | Order gateway port used by return use cases |
| `repositories/` | `PostgresReturnRepository`, port |
| `views/` | Schemas, mappers, DTO helpers |
| `controllers/` | Legacy Fastify `return.routes.js` |
| `controllers/nest/` | NestJS module/controller/service |
| `public/` | Cross-module command/query ports + Nest DI exports |
| `index.js` | `createReturnsModule` |
