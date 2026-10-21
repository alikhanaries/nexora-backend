import { getCurrencyMinorUnitExponent, minorUnitsToDecimal } from '../../../../shared/money/index.js';

const EXTERNAL_ORDER_STATUS_BY_PLATFORM_STATUS = {
    NEW: 'NEW',
    CONFIRMED: 'IN_PROGRESS',
    PROCESSING: 'IN_PROGRESS',
    READY_TO_SHIP: 'IN_PROGRESS',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'CLOSED',
    CANCELLED: 'CANCELED',
    RETURNED: 'RETURNED',
};

const EXTERNAL_LINE_STATUS_BY_PLATFORM_LINE_STATUS = {
    OPEN: 'IN_PROGRESS',
    CANCELLED: 'CANCELED',
    CLOSED: 'CLOSED',
};

/**
 * Maps platform address fields to merchant compatibility v2 PascalCase address DTO.
 * @param {object|null|undefined} address Core customer address or null.
 * @returns {object|null} External address or null when input absent.
 */
function mapExternalAddress(address) {
    if (address === null || address === undefined) {
        return null;
    }
    return {
        Line1: address.line1,
        Line2: address.line2,
        City: address.city,
        Region: address.region,
        ZipCode: address.postalCode,
        CountryIso: address.countryCode,
    };
}

/**
 * @param {object} line
 * @param {number|undefined} externalLineId
 */
function mapExternalOrderLine(line, externalLineId) {
    const quantity = line.quantity;
    const currency = line.currency;
    const lineTotalDecimal = minorUnitsToDecimal(currency, line.lineTotalMinor);
    const exponent = getCurrencyMinorUnitExponent(currency);
    const unitPriceInclVat = quantity > 0
        ? Number((lineTotalDecimal / quantity).toFixed(exponent))
        : minorUnitsToDecimal(currency, line.unitPriceMinor);
    return {
        ...(externalLineId === undefined ? {} : { Id: externalLineId }),
        ChannelProductNo: line.merchantSku,
        MerchantProductNo: line.merchantSku,
        Quantity: quantity,
        UnitPriceInclVat: unitPriceInclVat,
        LineTotalInclVat: lineTotalDecimal,
        Status: EXTERNAL_LINE_STATUS_BY_PLATFORM_LINE_STATUS[line.status] ?? 'IN_PROGRESS',
    };
}

/**
 * @param {Date|string} value ISO string or Date from core order timestamps.
 * @returns {Date} Parsed Date for external ISO fields.
 */
function toDate(value) {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string') {
        return new Date(value);
    }
    throw new TypeError('Expected a Date or ISO date string');
}

/**
 * @param {object} order
 * @param {object|null|undefined} channel
 * @param {{ orderIds?: Map<string, number>, orderLineIds?: Map<string, number> }} [externalIdMaps]
 */
export function mapExternalOrder(order, channel, externalIdMaps) {
    const customer = order.customer;
    const createdAt = toDate(order.createdAt);
    const updatedAt = toDate(order.updatedAt);
    const orderExternalId = externalIdMaps?.orderIds?.get(order.id);
    return {
        ...(orderExternalId === undefined ? {} : { Id: orderExternalId }),
        MerchantOrderNo: order.orderNumber,
        ChannelOrderNo: order.externalOrderReference,
        ChannelName: channel?.name ?? null,
        ChannelReference: channel?.externalReference ?? null,
        Status: EXTERNAL_ORDER_STATUS_BY_PLATFORM_STATUS[order.status] ?? 'IN_PROGRESS',
        Email: customer?.email ?? '',
        Phone: customer?.phone ?? null,
        CurrencyCode: order.currency,
        OrderDate: createdAt.toISOString(),
        CreatedAt: createdAt.toISOString(),
        UpdatedAt: updatedAt.toISOString(),
        BillingAddress: mapExternalAddress(customer?.billingAddress ?? null),
        ShippingAddress: mapExternalAddress(customer?.shippingAddress ?? null),
        SubTotalInclVat: minorUnitsToDecimal(order.currency, order.subtotalMinor),
        TotalInclVat: minorUnitsToDecimal(order.currency, order.totalMinor),
        ShippingCostsInclVat: minorUnitsToDecimal(order.currency, order.shippingMinor),
        Lines: order.lines.map((line) => mapExternalOrderLine(
            line,
            externalIdMaps?.orderLineIds?.get(line.id),
        )),
    };
}

/**
 * @param {{ items: object[], totalCount: number, page: number, pageSize: number }} page
 * @param {Map<string, object>} channelsById
 */
export function mapOrderPageToExternalCollection(page, channelsById, externalIdMaps) {
    const content = page.items.map((order) => mapExternalOrder(
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

/** External statuses that have no platform equivalent — filtered requests return empty results. */
export const UNMAPPED_EXTERNAL_ORDER_STATUSES = [
    'IN_BACKORDER',
    'MANCO',
    'IN_COMBI',
    'REQUIRES_CORRECTION',
    'AWAITING_PAYMENT',
];

const EXTERNAL_TO_PLATFORM_ORDER_STATUSES = {
    NEW: ['NEW'],
    IN_PROGRESS: ['CONFIRMED', 'PROCESSING', 'READY_TO_SHIP'],
    SHIPPED: ['SHIPPED'],
    CLOSED: ['DELIVERED'],
    CANCELED: ['CANCELLED'],
    RETURNED: ['RETURNED'],
};

/**
 * Maps verified external order statuses to platform order statuses for querying.
 *
 * @param {string[]|undefined} externalStatuses
 * @returns {string[]|undefined} Platform statuses, or undefined when no status filter was requested.
 */
export function mapExternalStatusesToPlatformStatuses(externalStatuses) {
    if (externalStatuses === undefined) {
        return undefined;
    }
    const platformStatuses = new Set();
    for (const externalStatus of externalStatuses) {
        const mapped = EXTERNAL_TO_PLATFORM_ORDER_STATUSES[externalStatus];
        if (mapped !== undefined) {
            for (const status of mapped) {
                platformStatuses.add(status);
            }
        }
    }
    return [...platformStatuses];
}

/** External status filter preset for `/api/v2/orders/new` poll (maps to platform NEW). */
export function mapNewOrderStatusFilter() {
    return ['NEW'];
}

/**
 * @param {number} page
 * @param {number} pageSize
 */
export function mapEmptyOrderPageToExternalCollection(page, pageSize) {
    return {
        Success: true,
        StatusCode: 200,
        Content: [],
        Count: 0,
        TotalCount: 0,
        ItemsPerPage: pageSize,
    };
}
