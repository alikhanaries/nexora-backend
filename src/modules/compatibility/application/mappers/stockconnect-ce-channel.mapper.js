import { ChannelStatus } from '../../../channels/public/index.js';

/**
 * Maps Nexora channels to a ChannelEngine Merchant GET /channels style envelope for StockConnect.
 *
 * @param {object[]} channels
 */
export function mapChannelsToStockConnectCeCollection(channels) {
    const content = channels.map((channel) => {
        const channelId = parseCeInteger(channel.externalReference);
        return {
            LanguageCode: 'en',
            CountryCode: null,
            GlobalChannelId: channelId ?? null,
            GlobalChannelName: channel.name,
            Channels: [
                {
                    ChannelId: channelId ?? null,
                    IsEnabled: channel.status === ChannelStatus.ACTIVE,
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

function parseCeInteger(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return undefined;
    }
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}
