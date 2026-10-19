import { describe, expect, it, vi } from 'vitest';
import { ExecuteMarketplaceLifecycleJob } from '../../../src/modules/marketplace-order-ingestion/services/execute-marketplace-lifecycle-job.js';
import { MarketplaceLifecycleJobSource } from '../../../src/modules/marketplace-order-ingestion/models/marketplace-lifecycle-job-source.js';
import { MarketplaceWebhookEventKind } from '../../../src/modules/marketplace-webhook-ingestion/models/marketplace-webhook-event-kind.js';
import { wireMarketplaceOrderIngestion } from '../../../src/workers/bootstrap/wire-marketplace-order-ingestion.js';

const tenantA = '22222222-2222-4222-8222-222222222222';
const tenantB = '99999999-9999-4999-8999-999999999999';
const channelA = '33333333-3333-4333-8333-333333333333';
const channelB = '88888888-8888-4888-8888-888888888888';
const marketplaceId = '55555555-5555-4555-8555-555555555555';
const stockLocationId = '44444444-4444-4444-8444-444444444444';

/**
 * In-memory channels table. Queries only return a row when the session tenant
 * matches the row tenant, which is what PostgreSQL RLS does for channels.
 *
 * @param {Map<string, object>} rows
 */
function createTenantScopedDatabase(rows) {
    const withTenant = vi.fn(async (tenantId, work) => work({
        query: async (_sql, params) => {
            const [queryTenantId, channelId] = params;
            if (queryTenantId !== tenantId) {
                return { rows: [] };
            }
            const row = rows.get(`${tenantId}|${channelId}`);
            return { rows: row === undefined ? [] : [row] };
        },
    }));
    return {
        withTenant,
        database: { withTenant },
    };
}

function channelRow(tenantId, channelId) {
    const now = new Date('2026-10-08T10:00:00.000Z');
    return {
        id: channelId,
        tenant_id: tenantId,
        marketplace_id: marketplaceId,
        name: 'Noon test',
        external_reference: 'noon-e2e',
        status: 'ACTIVE',
        configuration_reference: stockLocationId,
        default_stock_location_id: null,
        created_at: now,
        updated_at: now,
    };
}

function buildWebhookJob(marketplaceKey, overrides = {}) {
    return {
        tenantId: tenantA,
        channelId: channelA,
        marketplaceKey,
        externalOrderId: 'NFBO-E2E-1791455032125',
        externalEventId: 'msg-noon-e2e-1791455032125',
        operation: 'apply_lifecycle_payload',
        source: MarketplaceLifecycleJobSource.WEBHOOK,
        processingKind: 'webhook_event',
        webhookEvent: {
            deduplicationKey: 'msg-noon-e2e-1791455032125',
            eventKind: MarketplaceWebhookEventKind.ORDER_UPDATE,
            marketplaceKey,
            resource: {
                type: 'order',
                lifecyclePayload: {
                    noonEvent: {
                        event_type: 'FBPI::ORDER_SYNC',
                        payload: { order_nr: 'NFBO-E2E-1791455032125' },
                    },
                },
            },
        },
        ...overrides,
    };
}

function wireChannels(rows) {
    const scoped = createTenantScopedDatabase(rows);
    const wired = wireMarketplaceOrderIngestion({
        database: scoped.database,
        createChannelOrder: { execute: async () => ({ order: {} }) },
        registerMarketplaceOrderAdapters: () => {},
    });
    return { ...scoped, channelQueryService: wired.channelQueryService };
}

function buildExecutor(channelQueryService, marketplaceKey) {
    const orderLifecycleProcessor = {
        process: vi.fn(async () => ({ outcome: 'applied', externalOrderReference: null })),
    };
    const lifecycleService = {
        apply: vi.fn(async () => ({ outcome: 'applied' })),
    };
    const marketplaceLookup = {
        findById: vi.fn(async () => ({ id: marketplaceId, key: marketplaceKey, status: 'ACTIVE' })),
    };
    const executor = new ExecuteMarketplaceLifecycleJob({
        orderLifecycleProcessor,
        lifecycleService,
        channelQueryService,
        marketplaceLookup,
    });
    return { executor, orderLifecycleProcessor, marketplaceLookup };
}

describe('marketplace worker tenant-aware channel resolution', () => {
    it('resolves a channel only inside the job tenant session and continues the lifecycle', async () => {
        const rows = new Map([[`${tenantA}|${channelA}`, channelRow(tenantA, channelA)]]);
        const { withTenant, channelQueryService } = wireChannels(rows);
        const { executor, orderLifecycleProcessor } = buildExecutor(channelQueryService, 'noon');

        const result = await executor.execute(buildWebhookJob('noon'));

        expect(withTenant).toHaveBeenCalledWith(tenantA, expect.any(Function));
        expect(orderLifecycleProcessor.process).toHaveBeenCalledOnce();
        expect(orderLifecycleProcessor.process).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: tenantA,
            channelId: channelA,
            event: expect.objectContaining({
                deduplicationKey: 'msg-noon-e2e-1791455032125',
            }),
        }));
        expect(result.outcome).toBe('applied');
    });

    it('does not resolve another tenant channel through the job tenant', async () => {
        const rows = new Map([[`${tenantB}|${channelB}`, channelRow(tenantB, channelB)]]);
        const { channelQueryService } = wireChannels(rows);
        const { executor, orderLifecycleProcessor } = buildExecutor(channelQueryService, 'noon');

        const result = await executor.execute(buildWebhookJob('noon', { channelId: channelB }));

        expect(result).toBeUndefined();
        expect(orderLifecycleProcessor.process).not.toHaveBeenCalled();
    });

    it('fails closed when the job tenant is missing or not a uuid', async () => {
        const rows = new Map([[`${tenantA}|${channelA}`, channelRow(tenantA, channelA)]]);
        const { withTenant, channelQueryService } = wireChannels(rows);
        const { executor, orderLifecycleProcessor } = buildExecutor(channelQueryService, 'noon');
        const job = buildWebhookJob('noon');

        await expect(executor.execute({ ...job, tenantId: undefined })).rejects.toThrow();
        await expect(executor.execute({ ...job, tenantId: 'not-a-tenant' })).rejects.toThrow();
        await expect(executor.execute({ ...job, tenantId: tenantB })).resolves.toBeUndefined();

        expect(withTenant).toHaveBeenCalledTimes(1);
        expect(withTenant).toHaveBeenCalledWith(tenantB, expect.any(Function));
        expect(orderLifecycleProcessor.process).not.toHaveBeenCalled();
    });

    it('forwards the same webhook deduplication key on a repeated delivery', async () => {
        const rows = new Map([[`${tenantA}|${channelA}`, channelRow(tenantA, channelA)]]);
        const { channelQueryService } = wireChannels(rows);
        const { executor, orderLifecycleProcessor } = buildExecutor(channelQueryService, 'noon');
        const job = buildWebhookJob('noon');

        await executor.execute(job);
        await executor.execute(job);

        expect(orderLifecycleProcessor.process).toHaveBeenCalledTimes(2);
        for (const call of orderLifecycleProcessor.process.mock.calls) {
            expect(call[0].event.deduplicationKey).toBe('msg-noon-e2e-1791455032125');
            expect(call[0].tenantId).toBe(tenantA);
        }
    });

    it.each(['noon', 'amazon', 'shopify', 'namshi'])(
        'continues the %s lifecycle after the tenant channel resolves',
        async (marketplaceKey) => {
            const rows = new Map([[`${tenantA}|${channelA}`, channelRow(tenantA, channelA)]]);
            const { channelQueryService } = wireChannels(rows);
            const { executor, orderLifecycleProcessor, marketplaceLookup } = buildExecutor(
                channelQueryService,
                marketplaceKey,
            );

            const result = await executor.execute(buildWebhookJob(marketplaceKey));

            expect(marketplaceLookup.findById).toHaveBeenCalledWith(marketplaceId);
            expect(orderLifecycleProcessor.process).toHaveBeenCalledOnce();
            expect(result.outcome).toBe('applied');
        },
    );
});
