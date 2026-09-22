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
 * @param {Array<{ id: string, merchantSku: string, quantity: number, shippedQuantity: number, returnedQuantity: number }>} orderLines
 */
function returnEligibleQuantity(orderLine) {
    return orderLine.shippedQuantity - orderLine.returnedQuantity;
}

/**
 * Maps external return lines to Nexora order line allocations.
 *
 * `MerchantProductNo` maps to the order line's snapshotted `merchantSku`.
 * External integer `OrderLineId` is accepted for contract compliance but is not used.
 *
 * @param {Array<{ MerchantProductNo: string, Quantity: string|number, OrderLineId?: string|number|null }>} externalLines
 * @param {Array<{ id: string, merchantSku: string, quantity: number, shippedQuantity: number, returnedQuantity: number }>} orderLines
 * @returns {Array<{ orderLineId: string, quantity: number }>}
 */
export function mapExternalReturnLinesToOrderLines(externalLines, orderLines) {
    const aggregated = aggregateExternalLines(externalLines);
    /** @type {Map<string, Array<{ id: string, merchantSku: string, quantity: number, shippedQuantity: number, returnedQuantity: number }>>} */
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
            const available = returnEligibleQuantity(line);
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
            const target = [...candidates].reverse().find((line) => returnEligibleQuantity(line) > 0) ?? candidates[0];
            allocations.set(target.id, (allocations.get(target.id) ?? 0) + remaining);
        }
    }

    return [...allocations.entries()].map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
}

/**
 * `MerchantReturnNo` maps to Nexora `Return.externalReference` (tenant-unique when set).
 *
 * @param {{
 *   MerchantOrderNo: string,
 *   MerchantReturnNo: string,
 *   Lines: Array<{ MerchantProductNo: string, Quantity: string|number, OrderLineId?: string|number|null }>,
 *   Reason?: string|null,
 *   MerchantComment?: string|null,
 *   CustomerComment?: string|null,
 *   TrackTraceNo?: string|null,
 *   Id?: string|number|null,
 * }} body
 */
export function mapExternalReturnRequest(body) {
    const orderNumber = body.MerchantOrderNo.trim();
    const merchantReturnNo = body.MerchantReturnNo.trim();
    if (orderNumber.length === 0) {
        throw new ValidationError('MerchantOrderNo is required');
    }
    if (merchantReturnNo.length === 0) {
        throw new ValidationError('MerchantReturnNo is required');
    }
    if (!Array.isArray(body.Lines) || body.Lines.length === 0) {
        throw new ValidationError('Return must contain at least one line');
    }
    const merchantComment = body.MerchantComment === undefined || body.MerchantComment === null
        ? null
        : body.MerchantComment.trim() || null;
    const customerComment = body.CustomerComment === undefined || body.CustomerComment === null
        ? null
        : body.CustomerComment.trim() || null;
    const reasonCode = body.Reason === undefined || body.Reason === null
        ? null
        : String(body.Reason).trim() || null;
    const reason = merchantComment ?? customerComment ?? reasonCode;
    return {
        orderNumber,
        merchantReturnNo,
        externalLines: body.Lines,
        reason,
    };
}

/**
 * @param {object} _result
 */
export function mapReturnResultToExternalResponse(_result) {
    return {
        Success: true,
        StatusCode: 201,
        Message: null,
    };
}

/**
 * @param {{
 *   orderNumber: string,
 *   merchantReturnNo: string,
 *   lines: Array<{ orderLineId: string, quantity: number }>,
 *   reason: string|null,
 * }} mapped
 */
export function fingerprintReturnCommand(mapped) {
    return JSON.stringify({
        orderNumber: mapped.orderNumber,
        merchantReturnNo: mapped.merchantReturnNo,
        lines: mapped.lines,
        reason: mapped.reason,
    });
}

const EXTERNAL_RETURN_STATUS_BY_NEXORA_STATUS = {
    REQUESTED: 'IN_PROGRESS',
    APPROVED: 'IN_PROGRESS',
    RECEIVED: 'IN_PROGRESS',
    COMPLETED: 'HANDLED',
    REJECTED: 'CANCELLED',
    CANCELLED: 'CANCELLED',
};

const EXTERNAL_TO_NEXORA_RETURN_STATUSES = {
    NEW: ['REQUESTED'],
    IN_PROGRESS: ['REQUESTED', 'APPROVED', 'RECEIVED'],
    HANDLED: ['COMPLETED'],
    CANCELLED: ['CANCELLED', 'REJECTED'],
};

/**
 * @param {string[]|undefined} externalStatuses
 * @returns {string[]|undefined}
 */
export function mapExternalReturnStatusesToNexoraStatuses(externalStatuses) {
    if (externalStatuses === undefined) {
        return undefined;
    }
    const nexoraStatuses = new Set();
    for (const externalStatus of externalStatuses) {
        const mapped = EXTERNAL_TO_NEXORA_RETURN_STATUSES[externalStatus];
        if (mapped !== undefined) {
            for (const status of mapped) {
                nexoraStatuses.add(status);
            }
        }
    }
    return [...nexoraStatuses];
}

export function mapNewReturnStatusFilter() {
    return ['IN_PROGRESS'];
}

/**
 * @param {object} line
 * @param {object|undefined} orderLine
 */
function mapExternalReturnLine(line, orderLine) {
    return {
        MerchantProductNo: orderLine?.merchantSku ?? null,
        Quantity: line.quantity,
    };
}

/**
 * @param {object} returnEntity
 * @param {object|undefined} order
 * @param {Map<string, object>} orderLinesById
 * @param {object|undefined} channel
 */
export function mapExternalReturn(returnEntity, order, orderLinesById, channel) {
    return {
        MerchantOrderNo: order?.orderNumber ?? null,
        ChannelOrderNo: order?.externalOrderReference ?? null,
        ChannelName: channel?.name ?? null,
        Lines: returnEntity.lines.map((line) => mapExternalReturnLine(line, orderLinesById.get(line.orderLineId))),
        CreatedAt: returnEntity.createdAt.toISOString(),
        UpdatedAt: returnEntity.updatedAt.toISOString(),
        MerchantReturnNo: returnEntity.externalReference,
        Status: EXTERNAL_RETURN_STATUS_BY_NEXORA_STATUS[returnEntity.status] ?? 'IN_PROGRESS',
        Reason: returnEntity.reason,
    };
}

/**
 * @param {object} returnEntity
 * @param {object|undefined} order
 * @param {Map<string, object>} orderLinesById
 */
export function mapExternalSingleOrderReturn(returnEntity, order, orderLinesById) {
    return {
        MerchantOrderNo: order?.orderNumber ?? null,
        Lines: returnEntity.lines.map((line) => mapExternalReturnLine(line, orderLinesById.get(line.orderLineId))),
        CreatedAt: returnEntity.createdAt.toISOString(),
        UpdatedAt: returnEntity.updatedAt.toISOString(),
        MerchantReturnNo: returnEntity.externalReference,
        Status: EXTERNAL_RETURN_STATUS_BY_NEXORA_STATUS[returnEntity.status] ?? 'IN_PROGRESS',
    };
}

/**
 * @param {{ items: object[], totalCount: number, page: number, pageSize: number }} page
 * @param {Map<string, object>} ordersById
 * @param {Map<string, object>} channelsById
 */
export function mapReturnPageToExternalCollection(page, ordersById, channelsById) {
    const content = page.items.map((returnEntity) => {
        const order = ordersById.get(returnEntity.orderId);
        const orderLinesById = new Map((order?.lines ?? []).map((line) => [line.id, line]));
        const channel = order === undefined ? undefined : channelsById.get(order.channelId);
        return mapExternalReturn(returnEntity, order, orderLinesById, channel);
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
 * @param {object[]} items
 * @param {Map<string, object>} ordersById
 */
export function mapSingleOrderReturnCollection(items, ordersById) {
    const content = items.map((returnEntity) => {
        const order = ordersById.get(returnEntity.orderId);
        const orderLinesById = new Map((order?.lines ?? []).map((line) => [line.id, line]));
        return mapExternalSingleOrderReturn(returnEntity, order, orderLinesById);
    });
    return {
        Success: true,
        StatusCode: 200,
        Content: content,
        Count: content.length,
        TotalCount: content.length,
        ItemsPerPage: content.length === 0 ? 50 : content.length,
    };
}

/**
 * @param {number} pageSize
 */
export function mapEmptyReturnPageToExternalCollection(pageSize) {
    return {
        Success: true,
        StatusCode: 200,
        Content: [],
        Count: 0,
        TotalCount: 0,
        ItemsPerPage: pageSize,
    };
}
