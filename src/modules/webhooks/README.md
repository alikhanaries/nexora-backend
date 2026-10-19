# Webhooks

All webhook concerns live in this module, grouped by kind:

```
webhooks/
├── outbound/       Merchant outbound subscriptions + delivery (MVC)
├── marketplace/    Inbound marketplace webhook ingestion (MVC)
└── index.js        Public composers for both
```

Do not add a new top-level `src/modules/*-webhook*` module — add a folder here instead.
