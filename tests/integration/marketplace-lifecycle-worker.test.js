import { Queue, Worker } from 'bullmq';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { JobName } from '../../src/infrastructure/queue/queue-names.js';
import { ExecuteMarketplaceLifecycleJob } from '../../src/modules/marketplace-order-ingestion/application/execute-marketplace-lifecycle-job.js';
import { MarketplaceOrderLifecycleProcessor } from '../../src/modules/marketplace-webhook-ingestion/application/marketplace-order-lifecycle-processor.js';
import { MarketplaceWebhookEventKind } from '../../src/modules/marketplace-webhook-ingestion/domain/marketplace-webhook-event-kind.js';
import { NormalizedMarketplaceOrderStatus } from '../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('marketplace lifecycle worker integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('enqueue → worker → mocked lifecycle processor completes', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        const config = loadConfig(process.env);
        const queueName = config.marketplaceLifecycle.queueName;
        const ingest = vi.fn(async () => ({ outcome: 'created', externalOrderReference: 'ext-1' }));
        const orderLifecycleProcessor = new MarketplaceOrderLifecycleProcessor({
            ingestNormalizedMarketplaceOrder: { execute: ingest },
        });
        const tenantId = '22222222-2222-4222-8222-222222222222';
        const channelId = '33333333-3333-4333-8333-333333333333';
        const executeMarketplaceLifecycleJob = new ExecuteMarketplaceLifecycleJob({
            orderLifecycleProcessor,
            lifecycleService: app.marketplaceOrderIngestion.lifecycleService,
            channelQueryService: {
                getChannelById: async () => ({
                    tenantId,
                    channelId,
                    marketplaceId: '55555555-5555-4555-8555-555555555555',
                }),
            },
            marketplaceLookup: {
                findById: async () => ({ id: '55555555-5555-4555-8555-555555555555', key: 'shopify', status: 'active' }),
            },
        });
        const worker = new Worker(queueName, async (job) => {
            if (job.name !== JobName.PROCESS_MARKETPLACE_LIFECYCLE) {
                return;
            }
            await executeMarketplaceLifecycleJob.execute(job.data, {
                id: job.id ?? 'unknown',
                name: job.name,
                queue: queueName,
                attempt: job.attemptsMade + 1,
                maxAttempts: job.opts.attempts ?? 5,
                moveToDelayed: async () => undefined,
            });
        }, {
            connection: infra.queueConnection,
            prefix: config.queue.prefix,
            concurrency: 1,
        });
        try {
            await app.marketplaceLifecycleEnqueueService.enqueueFromWebhook({
                tenantId,
                channelId,
                event: {
                    deduplicationKey: `dedup-${Date.now()}`,
                    eventKind: MarketplaceWebhookEventKind.ORDER_CREATE,
                    marketplaceKey: 'shopify',
                    resource: {
                        type: 'order',
                        order: {
                            externalOrderId: `order-${Date.now()}`,
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
            });
            await vi.waitFor(() => {
                expect(ingest).toHaveBeenCalled();
            }, { timeout: 10_000 });
        }
        finally {
            await worker.close();
            const queue = new Queue(queueName, { connection: infra.queueConnection, prefix: config.queue.prefix });
            await queue.close();
        }
    }, 20_000);
});
