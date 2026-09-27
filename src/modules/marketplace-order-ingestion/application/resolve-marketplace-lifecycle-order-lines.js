import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';

/**
 * Maps normalized lifecycle line hints to Nexora order line ids.
 *
 * @param {object} deps
 * @param {import('../../orders/infrastructure/postgres-order-repository.js').PostgresOrderRepository} deps.orders
 * @param {import('../../products/public/index.js').ProductQueryService} deps.productQueryService
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string} input.orderId
 * @param {{ merchantSku?: string, externalLineId?: string, quantity: number }[]} [input.lines]
 * @param {object} queryable
 */
export async function resolveMarketplaceLifecycleOrderLines(deps, input, queryable) {
    const orderLines = await deps.orders.listOrderLines(queryable, input.tenantId, input.orderId);
    if (orderLines.length === 0) {
        throw new ValidationError('Order has no lines');
    }
    if (input.lines === undefined || input.lines.length === 0) {
        return orderLines
            .filter((line) => line.cancellableQuantity() > 0)
            .map((line) => ({
                orderLineId: line.id,
                quantity: line.cancellableQuantity(),
            }));
    }
    const resolved = [];
    for (const hint of input.lines) {
        let matched = null;
        if (hint.merchantSku !== undefined) {
            const product = await deps.productQueryService.getProductBySku(input.tenantId, hint.merchantSku);
            if (product === null) {
                throw new NotFoundError('Product was not found for merchant SKU', { merchantSku: hint.merchantSku });
            }
            matched = orderLines.find((line) => line.productId === product.id);
        }
        if (matched === null || matched === undefined) {
            throw new NotFoundError('Could not resolve lifecycle line to an order line', {
                merchantSku: hint.merchantSku,
                externalLineId: hint.externalLineId,
            });
        }
        resolved.push({ orderLineId: matched.id, quantity: hint.quantity });
    }
    return resolved;
}
