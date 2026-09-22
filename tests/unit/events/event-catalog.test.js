import { describe, expect, it } from 'vitest';
import {
    getCatalogEntry,
    INTEGRATION_EVENT_CATALOG,
    isExternallyDeliverable,
    isKnownEventType,
    listExternallyDeliverableEventTypes,
    matchesCatalogVersion,
    PHASE_6_EXTERNAL_EVENT_ALLOWLIST,
} from '../../../src/shared/events/event-catalog.js';

const expectedAllowlist = [
    'order.created',
    'order.confirmed',
    'order.status_changed',
    'order.cancelled',
    'shipment.created',
    'shipment.shipped',
    'shipment.delivered',
    'shipment.cancelled',
    'shipment.status_changed',
    'cancellation.created',
    'cancellation.completed',
    'return.created',
    'return.status_changed',
];

describe('integration event catalog', () => {
    it('contains exactly the Phase 6 initial external allowlist', () => {
        expect(PHASE_6_EXTERNAL_EVENT_ALLOWLIST).toEqual(expectedAllowlist);
        expect(Object.keys(INTEGRATION_EVENT_CATALOG)).toEqual(expectedAllowlist);
    });

    it('marks every allowlisted event as externally deliverable at version 1', () => {
        for (const eventType of expectedAllowlist) {
            expect(isExternallyDeliverable(eventType)).toBe(true);
            expect(matchesCatalogVersion(eventType, 1)).toBe(true);
            expect(matchesCatalogVersion(eventType, 2)).toBe(false);
        }
    });

    it('looks up catalog metadata by event type', () => {
        const entry = getCatalogEntry('shipment.shipped');

        expect(entry).not.toBeNull();
        expect(entry?.description).toContain('shipped');
        expect(entry?.aggregateType).toBe('shipment');
        expect(entry?.producerModule).toBe('shipments');
        expect(entry?.piiClassification).toBe('low');
    });

    it('returns null for unknown event types', () => {
        expect(getCatalogEntry('product.created')).toBeNull();
        expect(isKnownEventType('product.created')).toBe(false);
        expect(isExternallyDeliverable('product.created')).toBe(false);
    });

    it('classifies free-text reason events as medium PII risk', () => {
        expect(getCatalogEntry('cancellation.created')?.piiClassification).toBe('medium');
        expect(getCatalogEntry('return.status_changed')?.piiClassification).toBe('medium');
    });

    it('classifies order and shipment events as low PII risk', () => {
        expect(getCatalogEntry('order.created')?.piiClassification).toBe('low');
        expect(getCatalogEntry('shipment.delivered')?.piiClassification).toBe('low');
    });

    it('lists externally deliverable types in allowlist order', () => {
        expect(listExternallyDeliverableEventTypes()).toEqual(expectedAllowlist);
    });
});
