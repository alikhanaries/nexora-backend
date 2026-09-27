import { describe, expect, it, vi } from 'vitest';
import { IdempotentRequestInProgressError } from '../../../src/shared/errors/index.js';
import { ReceiveMarketplaceWebhook } from '../../../src/modules/marketplace-webhook-ingestion/application/receive-marketplace-webhook.js';
import { MarketplaceOrderLifecycleProcessor } from '../../../src/modules/marketplace-webhook-ingestion/application/marketplace-order-lifecycle-processor.js';
import { MarketplaceWebhookAdapterRegistry } from '../../../src/modules/marketplace-webhook-ingestion/public/marketplace-webhook-adapter-registry.js';
import { MarketplaceWebhookAuthenticationError, MarketplaceWebhookPermanentError, MarketplaceWebhookRetryableError, MarketplaceWebhookUnsupportedError, } from '../../../src/modules/marketplace-webhook-ingestion/application/marketplace-webhook-errors.js';
import { MarketplaceWebhookEventKind } from '../../../src/modules/marketplace-webhook-ingestion/domain/marketplace-webhook-event-kind.js';
import { normalizedMarketplaceWebhookEventSchema } from '../../../src/modules/marketplace-webhook-ingestion/application/normalized-marketplace-webhook-event.schema.js';
import { MarketplaceOrderIngestionPermanentError, MarketplaceOrderIngestionRetryError, } from '../../../src/modules/marketplace-order-ingestion/public/marketplace-order-ingestion-errors.js';
import {
    buildTestWebhookPayload,
    createTestMarketplaceWebhookAdapter,
    signTestWebhookBody,
} from '../../helpers/test-marketplace-webhook-adapter.js';

const connection = {
    connectionId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    channelId: '33333333-3333-4333-8333-333333333333',
    marketplaceKey: 'shopify',
};

function buildService(overrides = {}) {
    const registry = new MarketplaceWebhookAdapterRegistry();
    registry.register(createTestMarketplaceWebhookAdapter('shopify'));
    const idempotency = {
        execute: vi.fn(async (_key, _fp, operation) => {
            const value = await operation();
            return { kind: 'executed', value };
        }),
    };
    const orderLifecycleProcessor = {
        process: vi.fn(async () => ({
            outcome: 'created',
            externalOrderReference: 'ext-1',
        })),
    };
    return {
        service: new ReceiveMarketplaceWebhook({
            resolveConnection: { execute: async () => connection },
            webhookAdapterRegistry: registry,
            orderLifecycleProcessor,
            idempotency,
            metrics: undefined,
            logger: undefined,
            ...overrides.deps,
        }),
        idempotency,
        orderLifecycleProcessor,
        registry,
    };
}

describe('ReceiveMarketplaceWebhook', () => {
    it('authenticates and processes a valid webhook', async () => {
        const { service, orderLifecycleProcessor } = buildService();
        const payload = buildTestWebhookPayload({
            marketplaceKey: 'shopify',
            externalOrderId: 'order-1',
            merchantSku: 'SKU-1',
            stockLocationId: '44444444-4444-4444-8444-444444444444',
        });
        const rawBody = JSON.stringify(payload);
        const result = await service.execute({
            ingressToken: 'test-token-value-1234567890',
            headers: { 'x-test-signature': signTestWebhookBody(rawBody) },
            rawBody,
        });
        expect(result.replayed).toBe(false);
        expect(result.data.outcome).toBe('created');
        expect(orderLifecycleProcessor.process).toHaveBeenCalledOnce();
    });

    it('rejects invalid signature', async () => {
        const { service } = buildService();
        const rawBody = JSON.stringify({ deduplicationKey: 'k', order: {} });
        await expect(service.execute({
            ingressToken: 'test-token-value-1234567890',
            headers: { 'x-test-signature': 'bad' },
            rawBody,
        })).rejects.toBeInstanceOf(MarketplaceWebhookAuthenticationError);
    });

    it('replays duplicate webhook via idempotency', async () => {
        let operationCount = 0;
        const idempotency = {
            execute: vi.fn(async (_key, _fp, operation) => {
                operationCount += 1;
                if (operationCount === 1) {
                    const value = await operation();
                    return { kind: 'executed', value };
                }
                return { kind: 'replayed', value: { outcome: 'created', externalOrderReference: 'ext-1' } };
            }),
        };
        const { service, orderLifecycleProcessor } = buildService({
            deps: { idempotency },
        });
        const payload = buildTestWebhookPayload({
            marketplaceKey: 'shopify',
            externalOrderId: 'order-dup',
            merchantSku: 'SKU-1',
            stockLocationId: '44444444-4444-4444-8444-444444444444',
        });
        const rawBody = JSON.stringify(payload);
        const headers = { 'x-test-signature': signTestWebhookBody(rawBody) };
        const input = { ingressToken: 'test-token-value-1234567890', headers, rawBody };
        await service.execute(input);
        const second = await service.execute(input);
        expect(second.replayed).toBe(true);
        expect(orderLifecycleProcessor.process).toHaveBeenCalledOnce();
    });

    it('returns in-progress for concurrent duplicate webhook', async () => {
        const idempotency = {
            execute: vi.fn(async () => {
                throw new IdempotentRequestInProgressError();
            }),
        };
        const { service } = buildService({ deps: { idempotency } });
        const payload = buildTestWebhookPayload({
            marketplaceKey: 'shopify',
            externalOrderId: 'order-concurrent',
            merchantSku: 'SKU-1',
            stockLocationId: '44444444-4444-4444-8444-444444444444',
        });
        const rawBody = JSON.stringify(payload);
        await expect(service.execute({
            ingressToken: 'test-token-value-1234567890',
            headers: { 'x-test-signature': signTestWebhookBody(rawBody) },
            rawBody,
        })).rejects.toBeInstanceOf(IdempotentRequestInProgressError);
    });

    it('enforces tenant-scoped idempotency keys via connection resolver', async () => {
        const { service, idempotency } = buildService();
        const payload = buildTestWebhookPayload({
            marketplaceKey: 'shopify',
            externalOrderId: 'order-tenant',
            merchantSku: 'SKU-1',
            stockLocationId: '44444444-4444-4444-8444-444444444444',
        });
        const rawBody = JSON.stringify(payload);
        await service.execute({
            ingressToken: 'test-token-value-1234567890',
            headers: { 'x-test-signature': signTestWebhookBody(rawBody) },
            rawBody,
        });
        const key = idempotency.execute.mock.calls[0][0];
        expect(key.tenantId).toBe(connection.tenantId);
        expect(key.principalFingerprint).toBe(`marketplace-webhook:${connection.connectionId}`);
    });

    it('rejects unsupported marketplace webhook adapter', async () => {
        const registry = new MarketplaceWebhookAdapterRegistry();
        const { service } = buildService({
            deps: { webhookAdapterRegistry: registry },
        });
        const rawBody = '{}';
        await expect(service.execute({
            ingressToken: 'test-token-value-1234567890',
            headers: { 'x-test-signature': 'ignored' },
            rawBody,
        })).rejects.toBeInstanceOf(MarketplaceWebhookUnsupportedError);
    });

    it('rejects unsupported event kind from lifecycle processor', async () => {
        const registry = new MarketplaceWebhookAdapterRegistry();
        registry.register(createTestMarketplaceWebhookAdapter('shopify', { unsupportedEventKind: true }));
        const orderLifecycleProcessor = new MarketplaceOrderLifecycleProcessor({
            ingestNormalizedMarketplaceOrder: { execute: vi.fn() },
        });
        const { service } = buildService({
            deps: { webhookAdapterRegistry: registry, orderLifecycleProcessor },
        });
        const payload = buildTestWebhookPayload({
            marketplaceKey: 'shopify',
            externalOrderId: 'order-unsupported',
            merchantSku: 'SKU-1',
            stockLocationId: '44444444-4444-4444-8444-444444444444',
        });
        const rawBody = JSON.stringify(payload);
        await expect(service.execute({
            ingressToken: 'test-token-value-1234567890',
            headers: { 'x-test-signature': signTestWebhookBody(rawBody) },
            rawBody,
        })).rejects.toBeInstanceOf(MarketplaceWebhookUnsupportedError);
    });

    it('maps retryable ingestion failures', async () => {
        const orderLifecycleProcessor = {
            process: vi.fn(async () => {
                throw new MarketplaceOrderIngestionRetryError('retry me', { retryDelayMs: 10_000 });
            }),
        };
        const { service } = buildService({ deps: { orderLifecycleProcessor } });
        const payload = buildTestWebhookPayload({
            marketplaceKey: 'shopify',
            externalOrderId: 'order-retry',
            merchantSku: 'SKU-1',
            stockLocationId: '44444444-4444-4444-8444-444444444444',
        });
        const rawBody = JSON.stringify(payload);
        await expect(service.execute({
            ingressToken: 'test-token-value-1234567890',
            headers: { 'x-test-signature': signTestWebhookBody(rawBody) },
            rawBody,
        })).rejects.toBeInstanceOf(MarketplaceWebhookRetryableError);
    });

    it('maps permanent ingestion failures', async () => {
        const orderLifecycleProcessor = {
            process: vi.fn(async () => {
                throw new MarketplaceOrderIngestionPermanentError('bad order', { reason: 'test' });
            }),
        };
        const { service } = buildService({ deps: { orderLifecycleProcessor } });
        const payload = buildTestWebhookPayload({
            marketplaceKey: 'shopify',
            externalOrderId: 'order-permanent',
            merchantSku: 'SKU-1',
            stockLocationId: '44444444-4444-4444-8444-444444444444',
        });
        const rawBody = JSON.stringify(payload);
        await expect(service.execute({
            ingressToken: 'test-token-value-1234567890',
            headers: { 'x-test-signature': signTestWebhookBody(rawBody) },
            rawBody,
        })).rejects.toBeInstanceOf(MarketplaceWebhookPermanentError);
    });
});

describe('normalized marketplace webhook event schema', () => {
    it('accepts order.create events', () => {
        const event = {
            deduplicationKey: 'dedup-1',
            eventKind: MarketplaceWebhookEventKind.ORDER_CREATE,
            marketplaceKey: 'shopify',
            resource: {
                type: 'order',
                order: buildTestWebhookPayload({
                    marketplaceKey: 'shopify',
                    externalOrderId: 'ext',
                    merchantSku: 'SKU',
                    stockLocationId: '44444444-4444-4444-8444-444444444444',
                }).order,
            },
        };
        expect(normalizedMarketplaceWebhookEventSchema.parse(event).eventKind).toBe('order.create');
    });
});
