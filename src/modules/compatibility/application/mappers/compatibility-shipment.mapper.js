import { NotFoundError, ValidationError } from '../../../../shared/errors/index.js';

/**
 * @param {string|number} value
 */
function parsePositiveInteger(value) {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ValidationError('Quantity must be a positive integer');
    }
    return parsed;
}

/**
 * @param {Array<{ MerchantProductNo: string, Quantity: string|number, OrderLineId?: string|number|null }>} externalLines
 */
function aggregateExternalLines(externalLines) {
    /** @type {Map<string, number>} */
    const bySku = new Map();
    for (const line of externalLines) {
        const sku = line.MerchantProductNo.trim();
        if (sku.length === 0) {
            throw new ValidationError('MerchantProductNo is required');
        }
        const quantity = parsePositiveInteger(line.Quantity);
        bySku.set(sku, (bySku.get(sku) ?? 0) + quantity);
    }
    return bySku;
}

/**
 * @param {Array<{ id: string, merchantSku: string, quantity: number, cancelledQuantity: number, shippedQuantity: number }>} orderLines
 */
function shippableQuantity(orderLine) {
    return orderLine.quantity - orderLine.cancelledQuantity - orderLine.shippedQuantity;
}

/**
 * Maps external shipment lines to Nexora order line allocations.
 *
 * `MerchantProductNo` maps to the order line's snapshotted `merchantSku`.
 * External integer `OrderLineId` is accepted for contract compliance but is not used.
 *
 * @param {Array<{ MerchantProductNo: string, Quantity: string|number, OrderLineId?: string|number|null }>} externalLines
 * @param {Array<{ id: string, merchantSku: string, quantity: number, cancelledQuantity: number, shippedQuantity: number }>} orderLines
 * @returns {Array<{ orderLineId: string, quantity: number }>}
 */
export function mapExternalShipmentLinesToOrderLines(externalLines, orderLines) {
    const aggregated = aggregateExternalLines(externalLines);
    /** @type {Map<string, Array<{ id: string, merchantSku: string, quantity: number, cancelledQuantity: number, shippedQuantity: number }>>} */
    const linesBySku = new Map();
    for (const line of orderLines) {
        const sku = line.merchantSku;
        if (!linesBySku.has(sku)) {
            linesBySku.set(sku, []);
        }
        linesBySku.get(sku).push(line);
    }

    /** @type {Map<string, number>} */
    const allocations = new Map();
    for (const [sku, requestedQuantity] of aggregated) {
        const candidates = linesBySku.get(sku);
        if (candidates === undefined || candidates.length === 0) {
            throw new NotFoundError('Order line was not found for merchant product number', {
                merchantProductNo: sku,
            });
        }
        let remaining = requestedQuantity;
        for (const line of candidates) {
            const available = shippableQuantity(line);
            if (available <= 0) {
                continue;
            }
            const allocate = Math.min(remaining, available);
            if (allocate > 0) {
                allocations.set(line.id, (allocations.get(line.id) ?? 0) + allocate);
                remaining -= allocate;
            }
            if (remaining === 0) {
                break;
            }
        }
        if (remaining > 0) {
            const target = [...candidates].reverse().find((line) => shippableQuantity(line) > 0) ?? candidates[0];
            allocations.set(target.id, (allocations.get(target.id) ?? 0) + remaining);
        }
    }

    return [...allocations.entries()].map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
}

/**
 * `MerchantShipmentNo` maps to Nexora `Shipment.externalReference` (tenant-unique when set).
 *
 * @param {{
 *   MerchantShipmentNo: string,
 *   MerchantOrderNo: string,
 *   Lines: Array<{ MerchantProductNo: string, Quantity: string|number, OrderLineId?: string|number|null }>,
 *   Method?: string|null,
 *   TrackTraceNo?: string|null,
 * }} body
 */
export function mapExternalShipmentRequest(body) {
    const orderNumber = body.MerchantOrderNo.trim();
    const merchantShipmentNo = body.MerchantShipmentNo.trim();
    if (orderNumber.length === 0) {
        throw new ValidationError('MerchantOrderNo is required');
    }
    if (merchantShipmentNo.length === 0) {
        throw new ValidationError('MerchantShipmentNo is required');
    }
    if (!Array.isArray(body.Lines) || body.Lines.length === 0) {
        throw new ValidationError('Shipment must contain at least one line');
    }
    const carrier = body.Method === undefined || body.Method === null ? null : body.Method.trim() || null;
    const trackingNumber = body.TrackTraceNo === undefined || body.TrackTraceNo === null
        ? null
        : body.TrackTraceNo.trim() || null;
    return {
        orderNumber,
        merchantShipmentNo,
        externalLines: body.Lines,
        carrier,
        trackingNumber,
    };
}

/**
 * @param {object} _result
 */
export function mapShipmentResultToExternalResponse(_result) {
    return {
        Success: true,
        StatusCode: 201,
        Message: null,
    };
}

/**
 * @param {object} _result
 */
export function mapShipmentTrackingResultToExternalResponse(_result) {
    return {
        Success: true,
        StatusCode: 200,
        Message: null,
    };
}

/**
 * Maps verified Merchant PUT /v2/shipments/{merchantShipmentNo} tracking payload.
 *
 * @param {object} body
 */
export function mapExternalShipmentTrackingRequest(body) {
    const method = body.Method?.trim() ?? '';
    const trackTraceNo = body.TrackTraceNo?.trim() ?? '';
    if (method.length === 0) {
        throw new ValidationError('Method is required');
    }
    if (trackTraceNo.length === 0) {
        throw new ValidationError('TrackTraceNo is required');
    }
    return {
        carrier: method,
        trackingNumber: trackTraceNo,
    };
}

/**
 * @param {{ merchantShipmentNo: string, carrier: string, trackingNumber: string }} mapped
 */
export function fingerprintUpdateShipmentTrackingCommand(mapped) {
    return JSON.stringify({
        merchantShipmentNo: mapped.merchantShipmentNo,
        carrier: mapped.carrier,
        trackingNumber: mapped.trackingNumber,
    });
}

/**
 * @param {{
 *   orderNumber: string,
 *   merchantShipmentNo: string,
 *   lines: Array<{ orderLineId: string, quantity: number }>,
 *   carrier: string|null,
 *   trackingNumber: string|null,
 * }} mapped
 */
export function fingerprintShipmentCommand(mapped) {
    return JSON.stringify({
        orderNumber: mapped.orderNumber,
        merchantShipmentNo: mapped.merchantShipmentNo,
        lines: mapped.lines,
        carrier: mapped.carrier,
        trackingNumber: mapped.trackingNumber,
    });
}

/**
 * @param {object} line
 * @param {object|undefined} orderLine
 */
function mapExternalShipmentLine(line, orderLine) {
    return {
        MerchantProductNo: orderLine?.merchantSku ?? null,
        ChannelProductNo: orderLine?.merchantSku ?? null,
        Quantity: line.quantity,
    };
}

/**
 * @param {object} shipment
 * @param {object|undefined} order
 * @param {Map<string, object>} orderLinesById
 */
/**
 * @param {object} shipment
 * @param {object|undefined} order
 * @param {Map<string, object>} orderLinesById
 * @param {{ shipmentIds?: Map<string, number> }} [externalIdMaps]
 */
export function mapExternalShipment(shipment, order, orderLinesById, externalIdMaps) {
    const shipmentExternalId = externalIdMaps?.shipmentIds?.get(shipment.id);
    return {
        ...(shipmentExternalId === undefined ? {} : { Id: shipmentExternalId }),
        MerchantShipmentNo: shipment.externalReference,
        MerchantOrderNo: order?.orderNumber ?? null,
        ChannelOrderNo: order?.externalOrderReference ?? null,
        Lines: shipment.lines.map((line) => mapExternalShipmentLine(line, orderLinesById.get(line.orderLineId))),
        CreatedAt: shipment.createdAt.toISOString(),
        UpdatedAt: shipment.updatedAt.toISOString(),
        TrackTraceNo: shipment.trackingNumber,
        Method: shipment.carrier,
        ShipmentDate: shipment.shippedAt === null ? null : shipment.shippedAt.toISOString(),
        DeliveredAt: shipment.deliveredAt === null ? null : shipment.deliveredAt.toISOString(),
    };
}

/**
 * @param {{ items: object[], totalCount: number, page: number, pageSize: number }} page
 * @param {Map<string, object>} ordersById
 */
export function mapShipmentPageToExternalCollection(page, ordersById, externalIdMaps) {
    const content = page.items.map((shipment) => {
        const order = ordersById.get(shipment.orderId);
        const orderLinesById = new Map((order?.lines ?? []).map((line) => [line.id, line]));
        return mapExternalShipment(shipment, order, orderLinesById, externalIdMaps);
    });
    return {
        Success: true,
        StatusCode: 200,
        Content: content,
        Count: content.length,
        TotalCount: page.totalCount,
        ItemsPerPage: page.pageSize,
    };
}

/**
 * @param {number} page
 * @param {number} pageSize
 */
export function mapEmptyShipmentPageToExternalCollection(page, pageSize) {
    return {
        Success: true,
        StatusCode: 200,
        Content: [],
        Count: 0,
        TotalCount: 0,
        ItemsPerPage: pageSize,
    };
}
