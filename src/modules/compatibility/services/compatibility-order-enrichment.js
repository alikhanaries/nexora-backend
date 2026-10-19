/**
 * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} orderQueryService
 * @param {string} tenantId
 * @param {string[]} orderIds
 */
export async function loadOrdersWithLines(orderQueryService, tenantId, orderIds) {
    const uniqueOrderIds = [...new Set(orderIds)];
    /** @type {Map<string, object>} */
    const ordersById = new Map();
    await Promise.all(uniqueOrderIds.map(async (orderId) => {
        const order = await orderQueryService.findOrderById(tenantId, orderId);
        if (order === null) {
            return;
        }
        const lines = await orderQueryService.getOrderLines(tenantId, orderId);
        ordersById.set(orderId, { ...order, lines });
    }));
    return ordersById;
}
