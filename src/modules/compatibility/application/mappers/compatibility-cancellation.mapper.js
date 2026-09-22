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
function cancellableQuantity(orderLine) {
    return orderLine.quantity - orderLine.cancelledQuantity - orderLine.shippedQuantity;
}

/**
 * Maps external cancellation lines to Nexora order line allocations.
 *
 * `MerchantProductNo` maps to the order line's snapshotted `merchantSku`.
 * External integer `OrderLineId` is accepted for contract compliance but is not used.
 *
 * @param {Array<{ MerchantProductNo: string, Quantity: string|number, OrderLineId?: string|number|null }>} externalLines
 * @param {Array<{ id: string, merchantSku: string, quantity: number, cancelledQuantity: number, shippedQuantity: number }>} orderLines
 * @returns {Array<{ orderLineId: string, quantity: number }>}
 */
export function mapExternalCancellationLinesToOrderLines(externalLines, orderLines) {
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
            const available = cancellableQuantity(line);
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
            const target = [...candidates].reverse().find((line) => cancellableQuantity(line) > 0) ?? candidates[0];
            allocations.set(target.id, (allocations.get(target.id) ?? 0) + remaining);
        }
    }

    return [...allocations.entries()].map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
}

/**
 * `MerchantCancellationNo` maps to Nexora `Cancellation.externalReference` (tenant-unique when set).
 *
 * @param {{
 *   MerchantCancellationNo: string,
 *   MerchantOrderNo: string,
 *   Lines: Array<{ MerchantProductNo: string, Quantity: string|number, OrderLineId?: string|number|null }>,
 *   Reason?: string|null,
 *   ReasonCode?: string|null,
 *   IsMerchantCreator?: boolean|null,
 * }} body
 */
export function mapExternalCancellationRequest(body) {
    const orderNumber = body.MerchantOrderNo.trim();
    const merchantCancellationNo = body.MerchantCancellationNo.trim();
    if (orderNumber.length === 0) {
        throw new ValidationError('MerchantOrderNo is required');
    }
    if (merchantCancellationNo.length === 0) {
        throw new ValidationError('MerchantCancellationNo is required');
    }
    if (!Array.isArray(body.Lines) || body.Lines.length === 0) {
        throw new ValidationError('Cancellation must contain at least one line');
    }
    const reason = body.Reason === undefined || body.Reason === null ? null : body.Reason.trim() || null;
    return {
        orderNumber,
        merchantCancellationNo,
        externalLines: body.Lines,
        reason,
    };
}

/**
 * @param {object} _result
 */
export function mapCancellationResultToExternalResponse(_result) {
    return {
        Success: true,
        StatusCode: 201,
        Message: null,
    };
}

/**
 * @param {{
 *   orderNumber: string,
 *   merchantCancellationNo: string,
 *   lines: Array<{ orderLineId: string, quantity: number }>,
 *   reason: string|null,
 * }} mapped
 */
export function fingerprintCancellationCommand(mapped) {
    return JSON.stringify({
        orderNumber: mapped.orderNumber,
        merchantCancellationNo: mapped.merchantCancellationNo,
        lines: mapped.lines,
        reason: mapped.reason,
    });
}

/**
 * @param {object} line
 * @param {object|undefined} orderLine
 */
function mapExternalCancellationLine(line, orderLine) {
    return {
        MerchantProductNo: orderLine?.merchantSku ?? null,
        ChannelProductNo: orderLine?.merchantSku ?? null,
        Quantity: line.quantity,
    };
}

/**
 * @param {object} cancellation
 * @param {object|undefined} order
 * @param {Map<string, object>} orderLinesById
 */
/**
 * @param {{ cancellationIds?: Map<string, number> }} [externalIdMaps]
 */
export function mapExternalCancellation(cancellation, order, orderLinesById, externalIdMaps) {
    const cancellationExternalId = externalIdMaps?.cancellationIds?.get(cancellation.id);
    return {
        ...(cancellationExternalId === undefined ? {} : { Id: cancellationExternalId }),
        MerchantCancellationNo: cancellation.externalReference,
        MerchantOrderNo: order?.orderNumber ?? null,
        ChannelOrderNo: order?.externalOrderReference ?? null,
        Lines: cancellation.lines.map((line) => mapExternalCancellationLine(line, orderLinesById.get(line.orderLineId))),
        CreatedAt: cancellation.createdAt.toISOString(),
        Reason: cancellation.reason,
        IsMerchantCreator: true,
    };
}

/**
 * @param {{ items: object[], totalCount: number, page: number, pageSize: number }} page
 * @param {Map<string, object>} ordersById
 */
export function mapCancellationPageToExternalCollection(page, ordersById, externalIdMaps) {
    const content = page.items.map((cancellation) => {
        const order = ordersById.get(cancellation.orderId);
        const orderLinesById = new Map((order?.lines ?? []).map((line) => [line.id, line]));
        return mapExternalCancellation(cancellation, order, orderLinesById, externalIdMaps);
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
 * @param {number} pageSize
 */
export function mapEmptyCancellationPageToExternalCollection(pageSize) {
    return {
        Success: true,
        StatusCode: 200,
        Content: [],
        Count: 0,
        TotalCount: 0,
        ItemsPerPage: pageSize,
    };
}
