import { IntegrationStatus } from '../../../commerce-integrations/public/index.js';

/**
 * Maps platform integrations to the public GET /api/v2/ce/channels response envelope.
 *
 * @param {object[]} channels
 */
export function mapIntegrationsToCompatV2Collection(channels) {
    const content = channels.map((channel) => {
        const channelId = parseCompatV2Integer(channel.externalReference);
        return {
            LanguageCode: 'en',
            CountryCode: null,
            GlobalChannelId: channelId ?? null,
            GlobalChannelName: channel.name,
            Channels: [
                {
                    ChannelId: channelId ?? null,
                    IsEnabled: channel.status === IntegrationStatus.ACTIVE,
                    ChannelName: channel.name,
                    Reference: channel.externalReference ?? channel.id,
                },
            ],
        };
    });
    return {
        Success: true,
        StatusCode: 200,
        Content: content,
        Count: content.length,
        TotalCount: content.length,
        ItemsPerPage: content.length || 1,
    };
}

function parseCompatV2Integer(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return undefined;
    }
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}
