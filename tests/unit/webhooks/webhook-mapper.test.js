import { describe, expect, it } from 'vitest';
import { toWebhookDeliveryResponse, toWebhookSubscriptionResponse } from '../../../src/modules/webhooks/presentation/webhook.mapper.js';

describe('webhook presentation mappers', () => {
    it('maps subscription DTOs without secrets or internal fields', () => {
        const mapped = toWebhookSubscriptionResponse({
            id: '11111111-1111-4111-8111-111111111111',
            tenantId: '22222222-2222-4222-8222-222222222222',
            url: 'https://example.com/hook',
            description: 'Orders',
            eventTypes: ['order.created'],
            status: 'ACTIVE',
            createdBy: '33333333-3333-4333-8333-333333333333',
            secretCiphertext: 'must-not-leak',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
        });
        expect(mapped).toEqual({
            id: '11111111-1111-4111-8111-111111111111',
            url: 'https://example.com/hook',
            description: 'Orders',
            eventTypes: ['order.created'],
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
        });
        expect(mapped).not.toHaveProperty('tenantId');
        expect(mapped).not.toHaveProperty('createdBy');
        expect(mapped).not.toHaveProperty('secret');
        expect(mapped).not.toHaveProperty('secretCiphertext');
    });

    it('maps delivery DTOs without tenant or signing material', () => {
        const mapped = toWebhookDeliveryResponse({
            id: '44444444-4444-4444-8444-444444444444',
            tenantId: '22222222-2222-4222-8222-222222222222',
            subscriptionId: '11111111-1111-4111-8111-111111111111',
            eventId: '55555555-5555-4555-8555-555555555555',
            eventType: 'order.created',
            status: 'DELIVERED',
            attemptCount: 1,
            nextAttemptAt: null,
            lastHttpStatus: 200,
            lastError: null,
            deliveredAt: '2026-01-03T00:00:00.000Z',
            createdAt: '2026-01-02T00:00:00.000Z',
        });
        expect(mapped).toEqual({
            id: '44444444-4444-4444-8444-444444444444',
            eventId: '55555555-5555-4555-8555-555555555555',
            eventType: 'order.created',
            status: 'DELIVERED',
            attemptCount: 1,
            nextAttemptAt: null,
            lastHttpStatus: 200,
            lastError: null,
            deliveredAt: '2026-01-03T00:00:00.000Z',
            createdAt: '2026-01-02T00:00:00.000Z',
        });
        expect(mapped).not.toHaveProperty('tenantId');
        expect(mapped).not.toHaveProperty('subscriptionId');
    });
});
