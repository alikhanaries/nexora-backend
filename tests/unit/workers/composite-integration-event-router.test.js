import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CompositeIntegrationEventRouter } from '../../../src/workers/handlers/composite-integration-event-router.js';

function buildEvent(overrides = {}) {
    return {
        id: randomUUID(),
        type: 'order.created',
        version: 1,
        aggregateType: 'order',
        aggregateId: randomUUID(),
        tenantId: randomUUID(),
        payload: {},
        correlationId: null,
        occurredAt: new Date(),
        ...overrides,
    };
}

describe('CompositeIntegrationEventRouter', () => {
    it('invokes every consumer handler in order', async () => {
        const calls = [];
        const consumers = [
            { handle: async () => { calls.push('logging'); } },
            { handle: async () => { calls.push('webhook'); } },
        ];
        const router = new CompositeIntegrationEventRouter(consumers);
        await router.route(buildEvent());
        expect(calls).toEqual(['logging', 'webhook']);
    });

    it('propagates the first handler failure', async () => {
        const consumers = [
            { handle: async () => { throw new Error('logging failed'); } },
            { handle: async () => { throw new Error('should not run'); } },
        ];
        const router = new CompositeIntegrationEventRouter(consumers);
        await expect(router.route(buildEvent())).rejects.toThrow('logging failed');
    });

    it('propagates a later handler failure after earlier handlers succeed', async () => {
        const calls = [];
        const consumers = [
            { handle: async () => { calls.push('logging'); } },
            { handle: async () => { throw new Error('webhook failed'); } },
        ];
        const router = new CompositeIntegrationEventRouter(consumers);
        await expect(router.route(buildEvent())).rejects.toThrow('webhook failed');
        expect(calls).toEqual(['logging']);
    });
});
