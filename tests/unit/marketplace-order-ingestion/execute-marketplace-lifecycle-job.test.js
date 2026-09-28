import { describe, expect, it, vi } from 'vitest';
import { ExecuteMarketplaceLifecycleJob } from '../../../src/modules/marketplace-order-ingestion/application/execute-marketplace-lifecycle-job.js';
import { MarketplaceLifecycleJobSource } from '../../../src/modules/marketplace-order-ingestion/domain/marketplace-lifecycle-job-source.js';
import { MarketplaceOrderLifecycleOperation } from '../../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-operation.js';
import { MarketplaceOrderLifecycleRetryError } from '../../../src/modules/marketplace-order-ingestion/public/marketplace-order-lifecycle-errors.js';
import { MarketplaceWebhookEventKind } from '../../../src/modules/marketplace-webhook-ingestion/domain/marketplace-webhook-event-kind.js';
import { NormalizedMarketplaceOrderStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-lifecycle-target-status.js';

const tenantId = '22222222-2222-4222-8222-222222222222';
const channelId = '33333333-3333-4333-8333-333333333333';

function buildWebhookJob(overrides = {}) {
    return {
        tenantId,
        channelId,
        marketplaceKey: 'shopify',
        externalOrderId: 'order-1',
        externalEventId: 'evt-1',
        operation: 'ingest_order',
        source: MarketplaceLifecycleJobSource.WEBHOOK,
        processingKind: 'webhook_event',
        webhookEvent: {
            deduplicationKey: 'evt-1',
            eventKind: MarketplaceWebhookEventKind.ORDER_CREATE,
            marketplaceKey: 'shopify',
            resource: {
                type: 'order',
                order: {
                    externalOrderId: 'order-1',
                    marketplaceKey: 'shopify',
                    status: NormalizedMarketplaceOrderStatus.CONFIRMED,
                    currency: 'USD',
                    lines: [{
                        merchantSku: 'SKU-1',
                        quantity: 1,
                        stockLocationId: '44444444-4444-4444-8444-444444444444',
                    }],
                },
            },
        },
        ...overrides,
    };
}

function buildExecutor(overrides = {}) {
    const channelQueryService = {
        getChannelById: vi.fn(async () => ({
            tenantId,
            channelId,
            marketplaceId: '55555555-5555-4555-8555-555555555555',
        })),
    };
    const marketplaceLookup = {
        findById: vi.fn(async () => ({ id: '55555555-5555-4555-8555-555555555555', key: 'shopify', status: 'active' })),
    };
    const orderLifecycleProcessor = {
        process: vi.fn(async () => ({ outcome: 'created', externalOrderReference: 'order-1' })),
    };
    const lifecycleService = {
        apply: vi.fn(async () => ({ outcome: 'applied', orderId: 'ord-1' })),
    };
    return {
        executor: new ExecuteMarketplaceLifecycleJob({
            orderLifecycleProcessor,
            lifecycleService,
            channelQueryService,
            marketplaceLookup,
            logger: undefined,
            metrics: undefined,
            ...overrides.deps,
        }),
        orderLifecycleProcessor,
        lifecycleService,
        channelQueryService,
        marketplaceLookup,
    };
}

describe('ExecuteMarketplaceLifecycleJob', () => {
    it('processes a valid webhook lifecycle job', async () => {
        const { executor, orderLifecycleProcessor } = buildExecutor();
        const result = await executor.execute(buildWebhookJob());
        expect(result.outcome).toBe('created');
        expect(orderLifecycleProcessor.process).toHaveBeenCalledOnce();
    });

    it('rejects malformed jobs', async () => {
        const { executor } = buildExecutor();
        await expect(executor.execute({ tenantId: 'not-a-uuid' })).rejects.toThrow();
    });

    it('retries retryable lifecycle failures', async () => {
        const orderLifecycleProcessor = {
            process: vi.fn(async () => {
                throw new MarketplaceOrderLifecycleRetryError('retry', { retryDelayMs: 2_000 });
            }),
        };
        const { executor } = buildExecutor({ deps: { orderLifecycleProcessor } });
        const moveToDelayed = vi.fn();
        await executor.execute(buildWebhookJob(), { moveToDelayed, attempt: 1, maxAttempts: 5 });
        expect(moveToDelayed).toHaveBeenCalledWith(2_000);
    });

    it('rejects tenant mismatch on channel lookup', async () => {
        const channelQueryService = {
            getChannelById: vi.fn(async () => ({
                tenantId: '99999999-9999-4999-8999-999999999999',
                channelId,
                marketplaceId: '55555555-5555-4555-8555-555555555555',
            })),
        };
        const { executor } = buildExecutor({ deps: { channelQueryService } });
        await executor.execute(buildWebhookJob());
    });

    it('rejects marketplace mismatch on channel', async () => {
        const marketplaceLookup = {
            findById: vi.fn(async () => ({ id: '55555555-5555-4555-8555-555555555555', key: 'amazon', status: 'active' })),
        };
        const { executor } = buildExecutor({ deps: { marketplaceLookup } });
        await executor.execute(buildWebhookJob());
    });

    it('applies inbound lifecycle commands from polling jobs', async () => {
        const { executor, lifecycleService } = buildExecutor();
        await executor.execute({
            tenantId,
            channelId,
            marketplaceKey: 'shopify',
            externalOrderId: 'order-1',
            externalEventId: 'poll-1',
            operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
            source: MarketplaceLifecycleJobSource.POLLING,
            processingKind: 'inbound_lifecycle_command',
            command: {
                marketplaceKey: 'shopify',
                externalOrderId: 'order-1',
                externalEventId: 'poll-1',
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        });
        expect(lifecycleService.apply).toHaveBeenCalledOnce();
    });
});
