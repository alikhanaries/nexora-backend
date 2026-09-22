import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/shared/errors/index.js';
import { validateWebhookEventTypes } from '../../../src/modules/webhooks/application/validate-webhook-event-types.js';

describe('validateWebhookEventTypes', () => {
    it('accepts externally deliverable event types', () => {
        const eventTypes = validateWebhookEventTypes(['order.created', 'shipment.shipped']);
        expect(eventTypes).toEqual(['order.created', 'shipment.shipped']);
    });

    it('deduplicates event types', () => {
        const eventTypes = validateWebhookEventTypes(['order.created', 'order.created']);
        expect(eventTypes).toEqual(['order.created']);
    });

    it('rejects unknown event types', () => {
        expect(() => validateWebhookEventTypes(['product.created'])).toThrow(ValidationError);
    });

    it('rejects empty event type lists', () => {
        expect(() => validateWebhookEventTypes([])).toThrow(ValidationError);
    });
});
