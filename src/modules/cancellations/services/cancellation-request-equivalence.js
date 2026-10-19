/**
 * @param {string|null|undefined} value
 */
export function normalizeOptionalCancellationText(value) {
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
 * @param {Array<{ orderLineId: string, quantity: number }>} lines
 */
export function normalizeCancellationLines(lines) {
    /** @type {Map<string, number>} */
    const byLine = new Map();
    for (const line of lines) {
        byLine.set(line.orderLineId, (byLine.get(line.orderLineId) ?? 0) + line.quantity);
    }
    return normalizeLineQuantities(byLine);
}

/**
 * @param {object} existingCancellation
 * @param {Array<{ orderLineId: string, quantity: number }>} existingLines
 * @param {object} input
 * @param {Map<string, number>} requestedByLine
 * @param {string|null} reason
 */
export function isEquivalentCancellationRequest(existingCancellation, existingLines, input, requestedByLine, reason) {
    if (existingCancellation.orderId !== input.orderId) {
        return false;
    }
    if (normalizeOptionalCancellationText(existingCancellation.reason) !== reason) {
        return false;
    }
    const existingNormalized = normalizeCancellationLines(existingLines.map((line) => ({
        orderLineId: line.orderLineId,
        quantity: line.quantity,
    })));
    const requestedNormalized = normalizeLineQuantities(requestedByLine);
    if (existingNormalized.length !== requestedNormalized.length) {
        return false;
    }
    return existingNormalized.every((line, index) => (
        line.orderLineId === requestedNormalized[index].orderLineId
        && line.quantity === requestedNormalized[index].quantity
    ));
}
