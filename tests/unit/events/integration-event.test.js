import { describe, expect, it } from 'vitest';
import {
    isIntegrationEvent,
    normalizeIntegrationEvent,
    parseIntegrationEvent,
    parseIntegrationEventInput,
} from '../../../src/shared/events/integration-event.js';

const sampleEvent = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    type: 'order.created',
    version: 1,
    aggregateType: 'order',
    aggregateId: '660e8400-e29b-41d4-a716-446655440001',
    tenantId: '770e8400-e29b-41d4-a716-446655440002',
    payload: {
        orderId: '660e8400-e29b-41d4-a716-446655440001',
        orderNumber: 'ORD-1001',
        status: 'CONFIRMED',
    },
    correlationId: 'req-123',
    occurredAt: new Date('2026-09-22T10:00:00.000Z'),
};

describe('integration event contract', () => {
    it('accepts a valid producer input without id or occurredAt', () => {
        const input = parseIntegrationEventInput({
            type: 'order.created',
            version: 1,
            aggregateType: 'order',
            aggregateId: sampleEvent.aggregateId,
            tenantId: sampleEvent.tenantId,
            payload: sampleEvent.payload,
            correlationId: null,
        });

        expect(input.type).toBe('order.created');
        expect(input.version).toBe(1);
        expect(input.id).toBeUndefined();
        expect(input.occurredAt).toBeUndefined();
    });

    it('accepts a complete persisted event', () => {
        const event = parseIntegrationEvent(sampleEvent);

        expect(event.id).toBe(sampleEvent.id);
        expect(event.type).toBe('order.created');
        expect(event.version).toBe(1);
        expect(event.occurredAt).toEqual(sampleEvent.occurredAt);
    });

    it('normalizes a complete event into the shared contract', () => {
        const normalized = normalizeIntegrationEvent(sampleEvent);

        expect(normalized).toEqual(sampleEvent);
        expect(isIntegrationEvent(normalized)).toBe(true);
    });

    it('rejects invalid event types', () => {
        expect(() => parseIntegrationEventInput({
            ...sampleEvent,
            type: 'OrderCreated',
        })).toThrow();
    });

    it('rejects non-positive versions', () => {
        expect(() => parseIntegrationEventInput({
            ...sampleEvent,
            version: 0,
        })).toThrow();
    });

    it('rejects persisted events missing required delivery fields', () => {
        expect(() => parseIntegrationEvent({
            type: 'order.created',
            version: 1,
            aggregateType: 'order',
            aggregateId: sampleEvent.aggregateId,
            tenantId: sampleEvent.tenantId,
            payload: sampleEvent.payload,
        })).toThrow();
    });
});
