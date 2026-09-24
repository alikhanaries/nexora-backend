import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';

/** @typedef {'fulfill_reservation' | 'record_sale_only'} InventoryConsumptionMode */

/**
 * Consumes inventory when a shipment first transitions to SHIPPED (ADR-027).
 *
 * @param {object} deps
 * @param {import('../../inventory/public/inventory-service.js').DefaultInventoryService} deps.inventoryService
 * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
 * @param {object} tx
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string} input.orderId
 * @param {string} input.shipmentId
 * @param {Array<{ id: string, orderLineId: string, quantity: number }>} input.shipmentLines
 * @param {InventoryConsumptionMode} [input.inventoryConsumptionMode]
 */
export async function fulfillInventoryWhenShipmentShipped(deps, tx, input) {
    const mode = input.inventoryConsumptionMode ?? 'fulfill_reservation';
    const orderLines = await deps.orderQueryService.getOrderLines(input.tenantId, input.orderId, tx);
    const orderLineById = new Map(orderLines.map((line) => [line.id, line]));
    for (const shipmentLine of input.shipmentLines) {
        const orderLine = orderLineById.get(shipmentLine.orderLineId);
        if (orderLine === undefined) {
            throw new NotFoundError('Order line was not found for shipment line', {
                orderId: input.orderId,
                orderLineId: shipmentLine.orderLineId,
            });
        }
        if (orderLine.stockLocationId === undefined || orderLine.stockLocationId === null) {
            throw new BusinessRuleError('Order line is missing stock location for inventory fulfillment', {
                orderLineId: orderLine.id,
            });
        }
        if (mode === 'record_sale_only') {
            await deps.inventoryService.recordSale({
                tenantId: input.tenantId,
                stockLocationId: orderLine.stockLocationId,
                productId: orderLine.productId,
                quantity: shipmentLine.quantity,
                referenceType: 'SHIPMENT',
                referenceId: input.shipmentId,
                idempotencyKey: shipmentLine.id,
            }, tx);
            continue;
        }
        await deps.inventoryService.fulfillReservedForShipment({
            tenantId: input.tenantId,
            stockLocationId: orderLine.stockLocationId,
            productId: orderLine.productId,
            quantity: shipmentLine.quantity,
            orderId: input.orderId,
            shipmentId: input.shipmentId,
            shipmentLineId: shipmentLine.id,
            orderLineId: orderLine.id,
        }, tx);
    }
}
