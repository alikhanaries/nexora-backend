# Orders module — physical MVC layout (Phase 4.6)

Authoritative structure for the **Orders** feature module:

| Folder | Responsibility |
|--------|----------------|
| `models/` | Domain entities and rules (`Order`, `OrderStatus`, …) |
| `services/` | Application use cases and orchestration (`createGetOrder`, `CreateOrder`, …) |
| `repositories/` | Persistence ports and PostgreSQL adapters |
| `views/` | API DTO mapping, Zod schemas, serializers (`order.mapper.js`, `order.schemas.js`, `order-dto.js`) |
| `controllers/` | HTTP entrypoints — legacy Fastify route table (`order.routes.js`) |
| `controllers/nest/` | NestJS `@Controller` / `@Injectable` adapters (framework-only) |
| `public/` | Cross-module contracts (`DefaultOrderQueryService`, command ports, …) |
| `index.js` | Composition root (`createOrdersModule`) |

Other Wasl modules may still use `application/` / `domain/` until migrated individually.
