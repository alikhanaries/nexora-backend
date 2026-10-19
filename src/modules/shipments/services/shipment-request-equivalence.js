/**
 * @param {string|null|undefined} value
 */
export function normalizeOptionalShipmentText(value) {
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
export function normalizeShipmentLines(lines) {
    /** @type {Map<string, number>} */
    const byLine = new Map();
    for (const line of lines) {
        byLine.set(line.orderLineId, (byLine.get(line.orderLineId) ?? 0) + line.quantity);
    }
    return normalizeLineQuantities(byLine);
}

/**
 * @param {object} existingShipment
 * @param {Array<{ orderLineId: string, quantity: number }>} existingLines
 * @param {object} input
 * @param {Map<string, number>} requestedByLine
 * @param {string|null} carrier
 * @param {string|null} trackingNumber
 */
export function isEquivalentShipmentRequest(existingShipment, existingLines, input, requestedByLine, carrier, trackingNumber) {
    if (existingShipment.orderId !== input.orderId) {
        return false;
    }
    if (normalizeOptionalShipmentText(existingShipment.carrier) !== carrier) {
        return false;
    }
    if (normalizeOptionalShipmentText(existingShipment.trackingNumber) !== trackingNumber) {
        return false;
    }
    const existingNormalized = normalizeShipmentLines(existingLines.map((line) => ({
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
