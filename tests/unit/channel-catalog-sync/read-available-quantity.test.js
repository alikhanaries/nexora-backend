import { describe, expect, it } from 'vitest';
import { readAvailableQuantityAtLocation } from '../../../src/modules/channel-catalog-sync/application/read-available-quantity.js';

describe('readAvailableQuantityAtLocation', () => {
    const stockLocationId = '44444444-4444-4444-8444-444444444444';

    it('returns available for matching location', () => {
        expect(readAvailableQuantityAtLocation({
            locations: [{
                stockLocationId,
                onHand: 100,
                reserved: 20,
                available: 80,
            }],
        }, stockLocationId)).toBe(80);
    });

    it('returns zero when no balance row exists', () => {
        expect(readAvailableQuantityAtLocation({ locations: [] }, stockLocationId)).toBe(0);
    });
});
