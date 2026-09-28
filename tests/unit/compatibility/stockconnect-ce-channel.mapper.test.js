import { describe, expect, it } from 'vitest';
import { mapChannelsToStockConnectCeCollection } from '../../../src/modules/compatibility/application/mappers/stockconnect-ce-channel.mapper.js';

describe('stockconnect-ce-channel.mapper', () => {
    it('maps numeric external reference to ChannelId', () => {
        const result = mapChannelsToStockConnectCeCollection([{
            id: 'ch-1',
            name: 'Noon',
            status: 'ACTIVE',
            externalReference: '1892',
        }]);
        expect(result.Content[0].GlobalChannelId).toBe(1892);
        expect(result.Content[0].Channels[0].ChannelId).toBe(1892);
    });

    it('omits integer ChannelId when external reference is non-numeric', () => {
        const result = mapChannelsToStockConnectCeCollection([{
            id: 'ch-2',
            name: 'Alpha',
            status: 'ACTIVE',
            externalReference: 'noon-uae',
        }]);
        expect(result.Content[0].GlobalChannelId).toBeNull();
        expect(result.Content[0].Channels[0].ChannelId).toBeNull();
        expect(result.Content[0].Channels[0].Reference).toBe('noon-uae');
    });

    it('handles missing external reference', () => {
        const result = mapChannelsToStockConnectCeCollection([{
            id: 'ch-3',
            name: 'Unset',
            status: 'ACTIVE',
            externalReference: null,
        }]);
        expect(result.Content[0].GlobalChannelId).toBeNull();
        expect(result.Content[0].Channels[0].Reference).toBe('ch-3');
    });
});
