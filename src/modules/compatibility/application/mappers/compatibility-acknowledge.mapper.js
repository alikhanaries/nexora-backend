/**
 * Maps an external acknowledge request to the Nexora order command input.
 *
 * Order lookup uses `MerchantOrderNo` → Nexora `orderNumber`.
 * External integer `OrderId` is resolved in the compatibility command layer.
 *
 * @param {{ MerchantOrderNo: string, OrderId: string|number }} body
 * @returns {{ orderNumber: string, externalOrderId: string|number }}
 */
export function mapExternalAcknowledgeRequest(body) {
    const orderNumber = body.MerchantOrderNo.trim();
    return { orderNumber, externalOrderId: body.OrderId };
}

/**
 * @param {{ order: { orderNumber: string, status: string } }} result
 */
export function mapAcknowledgeResultToExternalResponse(_result) {
    return {
        Success: true,
        StatusCode: 201,
        Message: null,
    };
}

/**
 * Fingerprint input for idempotency — uses mapped Nexora order number only.
 *
 * @param {{ orderNumber: string }} mapped
 */
export function fingerprintAcknowledgeCommand(mapped) {
    return JSON.stringify({ orderNumber: mapped.orderNumber });
}
