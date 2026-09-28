import { mapExternalOrder, mapOrderPageToExternalCollection } from './compatibility-order.mapper.js';

/**
 * @param {object|null|undefined} channel
 * @returns {number|undefined}
 */
function parseCeIntegerFromChannelReference(channel) {
    const reference = channel?.externalReference;
    if (typeof reference !== 'string' || reference.trim().length === 0) {
        return undefined;
    }
    const parsed = Number.parseInt(reference.trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * StockConnect expects CE-shaped orders with integer channel identifiers and line ExtraData arrays.
 *
 * @param {object} order
 * @param {object|null|undefined} channel
 * @param {{ orderIds?: Map<string, number>, orderLineIds?: Map<string, number> }} [externalIdMaps]
 */
export function mapStockConnectCeOrder(order, channel, externalIdMaps) {
    const base = mapExternalOrder(order, channel, externalIdMaps);
    const channelId = parseCeIntegerFromChannelReference(channel);
    return {
        ...base,
        ...(channelId === undefined ? {} : { ChannelId: channelId, GlobalChannelId: channelId }),
        GlobalChannelName: channel?.name ?? null,
        Lines: base.Lines.map((line) => ({
            ...line,
            ExtraData: Array.isArray(line.ExtraData) ? line.ExtraData : [],
        })),
    };
}

/**
 * @param {{ items: object[], totalCount: number, page: number, pageSize: number }} page
 * @param {Map<string, object>} channelsById
 * @param {{ orderIds?: Map<string, number>, orderLineIds?: Map<string, number> }} externalIdMaps
 */
export function mapStockConnectCeOrderPageToExternalCollection(page, channelsById, externalIdMaps) {
    const content = page.items.map((order) => mapStockConnectCeOrder(
        order,
        channelsById.get(order.channelId),
        externalIdMaps,
    ));
    return {
        Success: true,
        StatusCode: 200,
        Content: content,
        Count: content.length,
        TotalCount: page.totalCount,
        ItemsPerPage: page.pageSize,
    };
}
