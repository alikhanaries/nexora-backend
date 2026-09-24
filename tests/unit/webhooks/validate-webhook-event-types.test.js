import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/shared/errors/index.js';
import { validateWebhookEventTypes } from '../../../src/modules/webhooks/application/validate-webhook-event-types.js';

describe('validateWebhookEventTypes', () => {
    it('accepts externally deliverable event types', () => {
        const eventTypes = validateWebhookEventTypes(['order.created', 'shipment.shipped']);
        expect(eventTypes).toEqual(['order.created', 'shipment.shipped']);
    });

    it('accepts Phase 7.5 product and inventory event types', () => {
        const eventTypes = validateWebhookEventTypes([
            'product.created',
            'inventory.inventory_changed',
        ]);
        expect(eventTypes).toEqual(['product.created', 'inventory.inventory_changed']);
    });

    it('accepts Phase 11 offer, channel, and price event types', () => {
        const eventTypes = validateWebhookEventTypes([
            'offer.created',
            'channel.status_changed',
            'price.updated',
        ]);
        expect(eventTypes).toEqual(['offer.created', 'channel.status_changed', 'price.updated']);
    });

    it('deduplicates event types', () => {
        const eventTypes = validateWebhookEventTypes(['order.created', 'order.created']);
        expect(eventTypes).toEqual(['order.created']);
    });

    it('rejects unknown event types', () => {
        expect(() => validateWebhookEventTypes(['marketplace.created'])).toThrow(ValidationError);
    });

    it('rejects empty event type lists', () => {
        expect(() => validateWebhookEventTypes([])).toThrow(ValidationError);
    });
});
