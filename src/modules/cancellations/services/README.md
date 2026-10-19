# Cancellations module — physical MVC layout (Phase 4.7)

| Folder | Responsibility |
|--------|----------------|
| `models/` | `Cancellation`, lines, status transitions |
| `services/` | Factories (`createCreateCancellation`, `createGetCancellation`, …); deprecated class wrappers for public/`new` consumers |
| `repositories/` | `PostgresCancellationRepository`, repository port |
| `views/` | Zod schemas, HTTP mappers, internal DTO helpers |
| `controllers/` | Legacy Fastify `cancellation.routes.js` |
| `controllers/nest/` | NestJS `CancellationsModule` / controller / service |
| `public/` | Cross-module command/query ports and shared schemas |
| `index.js` | `createCancellationsModule` |
