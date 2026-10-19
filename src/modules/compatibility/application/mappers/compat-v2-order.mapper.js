import { mapExternalOrder } from './compatibility-order.mapper.js';

/**
 * @param {object|null|undefined} channel
 * @returns {number|undefined}
 */
function parseCompatV2IntegerFromIntegrationReference(channel) {
    const reference = channel?.externalReference;
    if (typeof reference !== 'string' || reference.trim().length === 0) {
        return undefined;
    }
    const parsed = Number.parseInt(reference.trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Compat v2 order shape (public `/api/v2/ce/*`) with integer integration identifiers and line ExtraData arrays.
 *
 * @param {object} order
 * @param {object|null|undefined} channel
 * @param {{ orderIds?: Map<string, number>, orderLineIds?: Map<string, number> }} [externalIdMaps]
 */
export function mapCompatV2Order(order, channel, externalIdMaps) {
    const base = mapExternalOrder(order, channel, externalIdMaps);
    const channelId = parseCompatV2IntegerFromIntegrationReference(channel);
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
export function mapCompatV2OrderPageToExternalCollection(page, channelsById, externalIdMaps) {
    const content = page.items.map((order) => mapCompatV2Order(
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
