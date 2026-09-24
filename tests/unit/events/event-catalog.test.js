import { describe, expect, it } from 'vitest';
import {
    findUndeliverableEventTypes,
    getCatalogEntry,
    INTEGRATION_EVENT_CATALOG,
    isExternallyDeliverable,
    isKnownEventType,
    listExternallyDeliverableEventTypes,
    matchesCatalogVersion,
    PHASE_6_EXTERNAL_EVENT_ALLOWLIST,
} from '../../../src/shared/events/event-catalog.js';

const phase6Allowlist = [
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

const phase75Allowlist = [
    'product.created',
    'product.updated',
    'product.status_changed',
    'inventory.inventory_changed',
    'inventory.inventory_reserved',
    'inventory.inventory_released',
];

const phase11Allowlist = [
    'offer.created',
    'offer.updated',
    'offer.status_changed',
    'channel.created',
    'channel.updated',
    'channel.status_changed',
    'price.created',
    'price.updated',
    'price.changed',
];

const expectedAllowlist = [...phase6Allowlist, ...phase75Allowlist, ...phase11Allowlist];

describe('integration event catalog', () => {
    it('contains the cumulative external allowlist through Phase 11', () => {
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
        expect(getCatalogEntry('marketplace.created')).toBeNull();
        expect(isKnownEventType('marketplace.created')).toBe(false);
        expect(isExternallyDeliverable('marketplace.created')).toBe(false);
    });

    it('classifies free-text reason events as medium PII risk', () => {
        expect(getCatalogEntry('cancellation.created')?.piiClassification).toBe('medium');
        expect(getCatalogEntry('return.status_changed')?.piiClassification).toBe('medium');
    });

    it('classifies order, shipment, product, and inventory events as low PII risk', () => {
        expect(getCatalogEntry('order.created')?.piiClassification).toBe('low');
        expect(getCatalogEntry('shipment.delivered')?.piiClassification).toBe('low');
        expect(getCatalogEntry('product.created')?.piiClassification).toBe('low');
        expect(getCatalogEntry('inventory.inventory_changed')?.piiClassification).toBe('low');
    });

    it('lists externally deliverable types in allowlist order', () => {
        expect(listExternallyDeliverableEventTypes()).toEqual(expectedAllowlist);
    });

    it('finds undeliverable event types for subscription validation', () => {
        expect(findUndeliverableEventTypes(['order.created', 'marketplace.created', 'unknown.event']))
            .toEqual(['marketplace.created', 'unknown.event']);
    });

    describe('Phase 7.5 catalog and inventory events', () => {
        it('registers product lifecycle events as externally deliverable', () => {
            for (const eventType of phase75Allowlist.filter((type) => type.startsWith('product.'))) {
                expect(isExternallyDeliverable(eventType)).toBe(true);
                expect(getCatalogEntry(eventType)?.producerModule).toBe('products');
            }
        });

        it('registers inventory events as externally deliverable', () => {
            for (const eventType of phase75Allowlist.filter((type) => type.startsWith('inventory.'))) {
                expect(isExternallyDeliverable(eventType)).toBe(true);
                expect(getCatalogEntry(eventType)?.producerModule).toBe('inventory');
            }
        });

        it('rejects marketplace events that are not in the catalog', () => {
            expect(isExternallyDeliverable('marketplace.created')).toBe(false);
            expect(isExternallyDeliverable('marketplace.status_changed')).toBe(false);
        });

        it('rejects malformed event types', () => {
            expect(isExternallyDeliverable('')).toBe(false);
            expect(isExternallyDeliverable('not-a-valid-event')).toBe(false);
        });
    });

    describe('Phase 11 commerce webhook catalog events', () => {
        it('registers offer, channel, and price events as externally deliverable', () => {
            expect(isExternallyDeliverable('offer.created')).toBe(true);
            expect(getCatalogEntry('offer.created')?.producerModule).toBe('offers');
            expect(isExternallyDeliverable('channel.updated')).toBe(true);
            expect(getCatalogEntry('channel.updated')?.producerModule).toBe('channels');
            expect(isExternallyDeliverable('price.changed')).toBe(true);
            expect(getCatalogEntry('price.changed')?.producerModule).toBe('pricing');
        });

        it('includes Phase 11 types in the cumulative allowlist', () => {
            for (const eventType of phase11Allowlist) {
                expect(PHASE_6_EXTERNAL_EVENT_ALLOWLIST).toContain(eventType);
            }
        });
    });
});
