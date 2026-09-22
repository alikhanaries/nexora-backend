/**
 * @param {string|null|undefined} value
 */
export function normalizeOptionalReturnText(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}

/**
 * @param {Map<string, number>} requestedByLine
 */
export function normalizeLineQuantities(requestedByLine) {
    return [...requestedByLine.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
}

/**
 * @param {Array<{ orderLineId: string, quantity: number, reason?: string|null }>} lines
 */
export function normalizeReturnLines(lines) {
    /** @type {Map<string, { quantity: number, reason: string|null }>} */
    const byLine = new Map();
    for (const line of lines) {
        const reason = normalizeOptionalReturnText(line.reason);
        const existing = byLine.get(line.orderLineId);
        if (existing === undefined) {
            byLine.set(line.orderLineId, { quantity: line.quantity, reason });
        }
        else {
            byLine.set(line.orderLineId, {
                quantity: existing.quantity + line.quantity,
                reason: existing.reason ?? reason,
            });
        }
    }
    return [...byLine.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([orderLineId, value]) => ({
            orderLineId,
            quantity: value.quantity,
            reason: value.reason,
        }));
}

/**
 * @param {object} existingReturn
 * @param {Array<{ orderLineId: string, quantity: number, reason?: string|null }>} existingLines
 * @param {object} input
 * @param {Map<string, number>} requestedByLine
 * @param {string|null} reason
 * @param {string|null} shipmentId
 */
export function isEquivalentReturnRequest(existingReturn, existingLines, input, requestedByLine, reason, shipmentId) {
    if (existingReturn.orderId !== input.orderId) {
        return false;
    }
    if (normalizeOptionalReturnText(existingReturn.reason) !== reason) {
        return false;
    }
    if ((existingReturn.shipmentId ?? null) !== shipmentId) {
        return false;
    }
    const existingNormalized = normalizeReturnLines(existingLines.map((line) => ({
        orderLineId: line.orderLineId,
        quantity: line.quantity,
        reason: line.reason,
    })));
    const requestedNormalized = normalizeLineQuantities(requestedByLine).map((line) => ({
        ...line,
        reason: null,
    }));
    if (existingNormalized.length !== requestedNormalized.length) {
        return false;
    }
    return existingNormalized.every((line, index) => (
        line.orderLineId === requestedNormalized[index].orderLineId
        && line.quantity === requestedNormalized[index].quantity
    ));
}
