import { describe, expect, it } from 'vitest';
import { BusinessRuleError } from '../../../src/shared/errors/index.js';
import {
    requireChannelStockLocationId,
    resolveChannelStockLocationId,
} from '../../../src/modules/channels/public/index.js';

const channelId = '22222222-2222-4222-8222-222222222222';
const stockLocationId = '44444444-4444-4444-8444-444444444444';

describe('resolveChannelStockLocationId', () => {
    it('prefers defaultStockLocationId', () => {
        expect(resolveChannelStockLocationId({
            id: channelId,
            defaultStockLocationId: stockLocationId,
            configurationReference: '77777777-7777-4777-8777-777777777777',
        })).toBe(stockLocationId);
    });

    it('falls back to configurationReference UUID', () => {
        expect(resolveChannelStockLocationId({
            id: channelId,
            defaultStockLocationId: null,
            configurationReference: stockLocationId,
        })).toBe(stockLocationId);
    });

    it('returns null when not configured', () => {
        expect(resolveChannelStockLocationId({
            id: channelId,
            defaultStockLocationId: null,
            configurationReference: null,
        })).toBeNull();
    });

    it('requireChannelStockLocationId throws when missing', () => {
        expect(() => requireChannelStockLocationId({
            id: channelId,
            configurationReference: 'not-a-uuid',
        })).toThrow(BusinessRuleError);
    });
});
