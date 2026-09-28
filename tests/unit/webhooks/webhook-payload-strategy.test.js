import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { resolveWebhookRequestBody } from '../../../src/modules/webhooks/application/webhook-payload-strategy.js';

describe('resolveWebhookRequestBody', () => {
    const subscription = { description: 'erp-bridge-alpha' };
    const event = {
        type: 'order.created',
        tenantId: randomUUID(),
        payload: { orderId: randomUUID() },
    };

    it('uses the first matching strategy', async () => {
        const customBody = '{"external":"payload"}';
        const strategies = [
            {
                matches: (sub) => sub.description === 'other',
                buildBody: vi.fn(),
            },
            {
                matches: (sub) => sub.description === 'erp-bridge-alpha',
                buildBody: vi.fn(async () => customBody),
            },
        ];
        const body = await resolveWebhookRequestBody(strategies, subscription, event);
        expect(body).toBe(customBody);
        expect(strategies[1].buildBody).toHaveBeenCalledWith(subscription, event);
    });

    it('falls back to the default Nexora webhook envelope when no strategy matches', async () => {
        const body = await resolveWebhookRequestBody([], subscription, {
            id: randomUUID(),
            type: 'order.created',
            version: 1,
            aggregateType: 'order',
            aggregateId: randomUUID(),
            tenantId: event.tenantId,
            payload: event.payload,
            occurredAt: new Date('2026-01-01T00:00:00.000Z'),
            correlationId: null,
        });
        expect(body).toContain('"type":"order.created"');
    });
});
