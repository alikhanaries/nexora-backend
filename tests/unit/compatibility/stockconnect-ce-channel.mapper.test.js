import { describe, expect, it } from 'vitest';
import { mapIntegrationsToCompatV2Collection } from '../../../src/modules/compatibility/services/mappers/compat-v2-integration.mapper.js';

describe('compat-v2-integration.mapper', () => {
    it('maps numeric external reference to ChannelId', () => {
        const result = mapIntegrationsToCompatV2Collection([{
            id: 'ch-1',
            name: 'Noon',
            status: 'ACTIVE',
            externalReference: '1892',
        }]);
        expect(result.Content[0].GlobalChannelId).toBe(1892);
        expect(result.Content[0].Channels[0].ChannelId).toBe(1892);
    });

    it('omits integer ChannelId when external reference is non-numeric', () => {
        const result = mapIntegrationsToCompatV2Collection([{
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
        const result = mapIntegrationsToCompatV2Collection([{
            id: 'ch-3',
            name: 'Unset',
            status: 'ACTIVE',
            externalReference: null,
        }]);
        expect(result.Content[0].GlobalChannelId).toBeNull();
        expect(result.Content[0].Channels[0].Reference).toBe('ch-3');
    });
});
