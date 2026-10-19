import { describe, expect, it, vi } from 'vitest';
import { disposeInfrastructureResources } from '../../../src/app/dispose-infrastructure.js';

describe('disposeInfrastructureResources', () => {
    it('closes resources in consumer-before-connection order', async () => {
        const order = [];
        const resources = {
            workerObservabilityHttp: {
                close: vi.fn(async () => {
                    order.push('obs');
                }),
            },
            outboxPublisher: {
                stop: vi.fn(async () => {
                    order.push('outbox');
                }),
            },
            workerRuntime: {
                close: vi.fn(async () => {
                    order.push('workers');
                }),
            },
            queue: {
                close: vi.fn(async () => {
                    order.push('queue');
                }),
            },
            queueConnection: {
                quit: vi.fn(async () => {
                    order.push('queueConnection');
                }),
            },
            redis: {
                close: vi.fn(async () => {
                    order.push('redis');
                }),
            },
            database: {
                close: vi.fn(async () => {
                    order.push('postgres');
                }),
            },
            tracing: {
                shutdown: vi.fn(async () => {
                    order.push('tracing');
                }),
            },
        };

        await disposeInfrastructureResources(resources);

        expect(order).toEqual(['obs', 'outbox', 'workers', 'queue', 'redis', 'postgres', 'tracing']);
        expect(resources.queueConnection.quit).not.toHaveBeenCalled();
    });

    it('quits the raw queue connection when the queue wrapper was never created', async () => {
        const queueConnection = {
            quit: vi.fn(async () => undefined),
            disconnect: vi.fn(),
        };
        await disposeInfrastructureResources({ queueConnection });
        expect(queueConnection.quit).toHaveBeenCalledOnce();
    });

    it('continues closing remaining resources when one step fails', async () => {
        const logger = { warn: vi.fn() };
        const database = { close: vi.fn(async () => undefined) };
        await disposeInfrastructureResources({
            redis: {
                close: vi.fn(async () => {
                    throw new Error('redis close failed');
                }),
            },
            database,
        }, { logger });

        expect(database.close).toHaveBeenCalledOnce();
        expect(logger.warn).toHaveBeenCalledOnce();
        expect(logger.warn.mock.calls[0][0]).toMatchObject({
            step: 'redis.close',
            reason: 'redis close failed',
        });
    });
});
