# ERP integrations

Outbound / inbound adapters for external ERP systems.

Each ERP is a **separate** module under this directory:

```
src/modules/erp/
├── README.md
├── stock-connect/     StockConnect ERP adapter
└── <future-erp>/      Additional ERP integrations
```

Do not put shared business domain logic here — only ERP-specific HTTP, mappers, and schemas.
Core commerce stays in top-level modules (`orders`, `products`, `inventory`, …).
