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
 * When `resolvedOrderLineId` is present, the line is allocated directly to that order line.
 *
 * @param {Array<{ MerchantProductNo: string, Quantity: string|number, OrderLineId?: string|number|null, resolvedOrderLineId?: string }>} externalLines
 * @param {Array<{ id: string, merchantSku: string, quantity: number, shippedQuantity: number, returnedQuantity: number }>} orderLines
 * @returns {Array<{ orderLineId: string, quantity: number }>}
 */
export function mapExternalReturnLinesToOrderLines(externalLines, orderLines) {
    /** @type {Map<string, number>} */
    const allocations = new Map();
    const skuLines = [];
    for (const line of externalLines) {
        if (line.resolvedOrderLineId !== undefined) {
            const quantity = parsePositiveInteger(line.Quantity);
            allocations.set(
                line.resolvedOrderLineId,
                (allocations.get(line.resolvedOrderLineId) ?? 0) + quantity,
            );
            continue;
        }
        skuLines.push(line);
    }
    if (skuLines.length === 0) {
        return [...allocations.entries()].map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
    }
    const aggregated = aggregateExternalLines(skuLines);
    /** @type {Map<string, Array<{ id: string, merchantSku: string, quantity: number, shippedQuantity: number, returnedQuantity: number }>>} */
    const linesBySku = new Map();
    for (const line of orderLines) {
        const sku = line.merchantSku;
        if (!linesBySku.has(sku)) {
            linesBySku.set(sku, []);
        }
        linesBySku.get(sku).push(line);
    }

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
 * @param {object} _result
 */
export function mapReturnMutationResultToExternalResponse(_result) {
    return {
        Success: true,
        StatusCode: 200,
        Message: null,
    };
}

/**
 * @param {object} body
 */
export function mapExternalReturnAcknowledgeRequest(body) {
    const merchantReturnNo = body.MerchantReturnNo?.trim() ?? '';
    if (merchantReturnNo.length === 0) {
        throw new ValidationError('MerchantReturnNo is required');
    }
    return {
        merchantReturnNo,
        externalReturnId: body.ReturnId ?? null,
    };
}

/**
 * @param {object} body
 */
export function mapExternalReturnReceiveRequest(body) {
    if (!Array.isArray(body.Lines) || body.Lines.length === 0) {
        throw new ValidationError('Lines are required');
    }
    const lineDecisions = body.Lines.map((line) => ({
        merchantProductNo: line.MerchantProductNo.trim(),
        acceptedQuantity: parseNonNegativeInteger(line.AcceptedQuantity, 'AcceptedQuantity'),
        rejectedQuantity: parseNonNegativeInteger(line.RejectedQuantity, 'RejectedQuantity'),
    }));
    return {
        externalReturnId: body.ReturnId,
        lineDecisions,
    };
}

/**
 * @param {{ merchantReturnNo: string, externalReturnId?: string|number|null }} mapped
 */
export function fingerprintAcknowledgeReturnCommand(mapped) {
    return JSON.stringify({
        merchantReturnNo: mapped.merchantReturnNo,
        externalReturnId: mapped.externalReturnId ?? null,
    });
}

/**
 * @param {{ externalReturnId: string|number, lineDecisions: object[] }} mapped
 */
export function fingerprintProcessReturnReceiveCommand(mapped) {
    return JSON.stringify({
        externalReturnId: mapped.externalReturnId,
        lineDecisions: mapped.lineDecisions,
    });
}

/**
 * @param {string|number} value
 * @param {string} fieldName
 */
function parseNonNegativeInteger(value, fieldName) {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new ValidationError(`${fieldName} must be a non-negative integer`);
    }
    return parsed;
}

/**
 * @param {object} returnEntity
 * @param {object[]} orderLines
 * @param {Array<{ merchantProductNo: string, acceptedQuantity: number, rejectedQuantity: number }>} lineDecisions
 */
export function returnMatchesReceiveRequest(returnEntity, orderLines, lineDecisions) {
    const orderLineById = new Map(orderLines.map((line) => [line.id, line]));
    /** @type {Map<string, number>} */
    const returnQtyBySku = new Map();
    for (const returnLine of returnEntity.lines) {
        const orderLine = orderLineById.get(returnLine.orderLineId);
        if (orderLine === undefined) {
            return false;
        }
        const sku = orderLine.merchantSku;
        returnQtyBySku.set(sku, (returnQtyBySku.get(sku) ?? 0) + returnLine.quantity);
    }
    /** @type {Map<string, { acceptedQuantity: number, rejectedQuantity: number }>} */
    const decisionsBySku = new Map();
    for (const line of lineDecisions) {
        const existing = decisionsBySku.get(line.merchantProductNo) ?? {
            acceptedQuantity: 0,
            rejectedQuantity: 0,
        };
        decisionsBySku.set(line.merchantProductNo, {
            acceptedQuantity: existing.acceptedQuantity + line.acceptedQuantity,
            rejectedQuantity: existing.rejectedQuantity + line.rejectedQuantity,
        });
    }
    if (decisionsBySku.size !== returnQtyBySku.size) {
        return false;
    }
    for (const [sku, returnQuantity] of returnQtyBySku) {
        const decision = decisionsBySku.get(sku);
        if (decision === undefined) {
            return false;
        }
        if (decision.acceptedQuantity + decision.rejectedQuantity !== returnQuantity) {
            return false;
        }
    }
    return true;
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
/**
 * @param {{ returnIds?: Map<string, number> }} [externalIdMaps]
 */
export function mapExternalReturn(returnEntity, order, orderLinesById, channel, externalIdMaps) {
    const returnExternalId = externalIdMaps?.returnIds?.get(returnEntity.id);
    return {
        ...(returnExternalId === undefined ? {} : { Id: returnExternalId }),
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
export function mapExternalSingleOrderReturn(returnEntity, order, orderLinesById, externalIdMaps) {
    const returnExternalId = externalIdMaps?.returnIds?.get(returnEntity.id);
    return {
        ...(returnExternalId === undefined ? {} : { Id: returnExternalId }),
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
export function mapReturnPageToExternalCollection(page, ordersById, channelsById, externalIdMaps) {
    const content = page.items.map((returnEntity) => {
        const order = ordersById.get(returnEntity.orderId);
        const orderLinesById = new Map((order?.lines ?? []).map((line) => [line.id, line]));
        const channel = order === undefined ? undefined : channelsById.get(order.channelId);
        return mapExternalReturn(returnEntity, order, orderLinesById, channel, externalIdMaps);
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
export function mapSingleOrderReturnCollection(items, ordersById, externalIdMaps) {
    const content = items.map((returnEntity) => {
        const order = ordersById.get(returnEntity.orderId);
        const orderLinesById = new Map((order?.lines ?? []).map((line) => [line.id, line]));
        return mapExternalSingleOrderReturn(returnEntity, order, orderLinesById, externalIdMaps);
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
