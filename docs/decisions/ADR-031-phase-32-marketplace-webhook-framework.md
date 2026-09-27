# ADR-031: Phase 32 Generic Marketplace Webhook Framework

**Status:** Accepted  
**Date:** 2026-09-27  
**Phase:** 32 — inbound marketplace webhooks (framework only)

## Context

Phase 28–29 established normalized marketplace order ingestion and polling adapters. ADR-029 deferred inbound marketplace webhooks. Operators need a provider-neutral ingress path that reuses idempotency, tenant isolation, and `CreateChannelOrder` without embedding Shopify/Amazon/Noon/Namshi signature logic in generic services.

## Decision

Introduce module `marketplace-webhook-ingestion` with:

1. Public HTTP route `POST /api/v1/inbound/marketplace-webhooks/:ingressToken` (unauthenticated; ingress token resolves connection).
2. `MarketplaceWebhookAdapter` port for provider-specific authentication and normalization.
3. `NormalizedMarketplaceWebhookEvent` contract (Zod) with order resource payloads.
4. `ReceiveMarketplaceWebhook` orchestrator using existing `PostgresIdempotencyService`.
5. `MarketplaceOrderLifecycleProcessor` routing `order.create` to `IngestNormalizedMarketplaceOrder`.

Phase 32 explicitly excludes provider webhook implementations.

## Consequences

**Positive:** Clear boundary; duplicates safe; aligns with modular monolith rules.

**Negative:** Operators must configure ingress token hashes until connection upsert generates tokens in a follow-up phase.

## Related

- [ADR-029](ADR-029-marketplace-connector-framework.md)
- [webhook-ingestion.md](../marketplaces/webhook-ingestion.md)
- [order-ingestion.md](../marketplaces/order-ingestion.md)
