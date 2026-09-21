import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
const orderRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    status: z.string(),
});
const orderLineRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    order_id: z.string().uuid(),
    product_id: z.string().uuid(),
    stock_location_id: z.string().uuid(),
    shipped_quantity: z.coerce.number(),
    returned_quantity: z.coerce.number(),
});
const orderLineSelect = `id, tenant_id, order_id, product_id, stock_location_id,
  shipped_quantity, returned_quantity`;
export class PostgresReturnOrderGateway {
    async findOrder(queryable, tenantId, orderId) {
        const result = await queryable.query(`SELECT id, tenant_id, status FROM orders WHERE tenant_id = $1 AND id = $2`, [tenantId, orderId], { operation: 'returns.order_gateway.find_order' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        const parsed = parseOrThrow(orderRowSchema, row, 'orders row');
        return {
            id: parsed.id,
            tenantId: parsed.tenant_id,
            status: parsed.status,
        };
    }
    async lockOrderLinesForUpdate(transaction, tenantId, orderId) {
        const result = await transaction.query(`SELECT ${orderLineSelect}
       FROM order_lines
       WHERE tenant_id = $1 AND order_id = $2
       FOR UPDATE`, [tenantId, orderId], { operation: 'returns.order_gateway.lock_order_lines' });
        return result.rows.map((row) => {
            const parsed = parseOrThrow(orderLineRowSchema, row, 'order_lines row');
            return {
                id: parsed.id,
                tenantId: parsed.tenant_id,
                orderId: parsed.order_id,
                productId: parsed.product_id,
                stockLocationId: parsed.stock_location_id,
                shippedQuantity: parsed.shipped_quantity,
                returnedQuantity: parsed.returned_quantity,
            };
        });
    }
    async updateOrderLineReturnedQuantity(transaction, tenantId, orderLineId, returnedQuantity, updatedAt) {
        await transaction.query(`UPDATE order_lines
       SET returned_quantity = $3, updated_at = $4
       WHERE tenant_id = $1 AND id = $2`, [tenantId, orderLineId, returnedQuantity, updatedAt], { operation: 'returns.order_gateway.update_returned_quantity' });
    }
}
