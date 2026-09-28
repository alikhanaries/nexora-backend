import { mapChannelsToStockConnectCeCollection } from './mappers/stockconnect-ce-channel.mapper.js';

/**
 * StockConnect CE channel list query.
 */
export class StockConnectCeChannelCompatibilityQuery {
    deps;

    /** @param {{ channelQueryService: import('../../channels/public/channel-query-service.js').DefaultChannelQueryService }} deps */
    constructor(deps) {
        this.deps = deps;
    }

    async listChannels(input) {
        const channels = await this.deps.channelQueryService.listChannels(input.tenantId, {});
        return mapChannelsToStockConnectCeCollection(channels);
    }
}
