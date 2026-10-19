# Shipments module — physical MVC layout (Phase 4.8)

| Folder | Responsibility |
|--------|----------------|
| `models/` | `Shipment`, lines, status rules |
| `services/` | Create/ship/deliver/cancel, command/query services, inventory fulfillment hook |
| `repositories/` | `PostgresShipmentRepository`, port |
| `views/` | Schemas, mappers, DTO helpers |
| `controllers/` | Legacy Fastify `shipment.routes.js` |
| `controllers/nest/` | NestJS module/controller/service |
| `public/` | Cross-module command/query ports + Nest DI exports |
| `index.js` | `createShipmentsModule` |
