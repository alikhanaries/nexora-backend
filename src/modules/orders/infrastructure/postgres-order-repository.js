import { z } from 'zod';
import { encodeCursor } from '../../../shared/pagination/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { CustomerSnapshot } from '../domain/customer-snapshot.js';
import { OrderLine } from '../domain/order-line.js';
import { OrderLineStatus } from '../domain/order-line-status.js';
import { Order } from '../domain/order.js';
import { OrderStatus } from '../domain/order-status.js';
const orderRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    channel_id: z.string().uuid(),
    external_order_reference: z.string().nullable(),
    order_number: z.string(),
    status: z.enum([
        OrderStatus.NEW,
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.READY_TO_SHIP,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.RETURNED,
    ]),
    currency: z.string(),
    subtotal_minor: z.coerce.number(),
    discount_minor: z.coerce.number(),
    tax_minor: z.coerce.number(),
    shipping_minor: z.coerce.number(),
    total_minor: z.coerce.number(),
    created_at: z.date(),
    updated_at: z.date(),
    confirmed_at: z.date().nullable(),
    cancelled_at: z.date().nullable(),
    shipped_at: z.date().nullable(),
    delivered_at: z.date().nullable(),
});
const orderLineRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    order_id: z.string().uuid(),
    product_id: z.string().uuid(),
    offer_id: z.string().uuid().nullable(),
    stock_location_id: z.string().uuid(),
    merchant_sku: z.string(),
    product_type_snapshot: z.string(),
    quantity: z.coerce.number(),
    cancelled_quantity: z.coerce.number(),
    shipped_quantity: z.coerce.number(),
    returned_quantity: z.coerce.number(),
    unit_price_minor: z.coerce.number(),
    discount_minor: z.coerce.number(),
    tax_minor: z.coerce.number(),
    line_total_minor: z.coerce.number(),
    currency: z.string(),
    status: z.enum([OrderLineStatus.OPEN, OrderLineStatus.CANCELLED, OrderLineStatus.CLOSED]),
    created_at: z.date(),
    updated_at: z.date(),
});
const addressSnapshotSchema = z
    .object({
    line1: z.string().nullable().optional(),
    line2: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    countryCode: z.string().nullable().optional(),
})
    .strict();
const customerRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    order_id: z.string().uuid(),
    external_customer_reference: z.string().nullable(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    company_name: z.string().nullable(),
    billing_address: addressSnapshotSchema.nullable(),
    shipping_address: addressSnapshotSchema.nullable(),
    metadata: z.record(z.unknown()),
    created_at: z.date(),
});
function normalizeAddress(value) {
    if (value === null) {
        return null;
    }
    return {
        line1: value.line1 ?? null,
        line2: value.line2 ?? null,
        city: value.city ?? null,
        region: value.region ?? null,
        postalCode: value.postalCode ?? null,
        countryCode: value.countryCode ?? null,
    };
}
const orderSelect = `id, tenant_id, channel_id, external_order_reference, order_number, status,
  currency, subtotal_minor, discount_minor, tax_minor, shipping_minor, total_minor,
  created_at, updated_at, confirmed_at, cancelled_at, shipped_at, delivered_at`;
const orderSelectAliased = `o.id, o.tenant_id, o.channel_id, o.external_order_reference, o.order_number, o.status,
  o.currency, o.subtotal_minor, o.discount_minor, o.tax_minor, o.shipping_minor, o.total_minor,
  o.created_at, o.updated_at, o.confirmed_at, o.cancelled_at, o.shipped_at, o.delivered_at`;
const orderLineSelect = `id, tenant_id, order_id, product_id, offer_id, stock_location_id,
  merchant_sku, product_type_snapshot, quantity, cancelled_quantity, shipped_quantity,
  returned_quantity, unit_price_minor, discount_minor, tax_minor, line_total_minor, currency,
  status, created_at, updated_at`;
function toOrder(row) {
    return Order.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        channelId: row.channel_id,
        externalOrderReference: row.external_order_reference,
        orderNumber: row.order_number,
        status: row.status,
        currency: row.currency,
        subtotalMinor: row.subtotal_minor,
        discountMinor: row.discount_minor,
        taxMinor: row.tax_minor,
        shippingMinor: row.shipping_minor,
        totalMinor: row.total_minor,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        confirmedAt: row.confirmed_at,
        cancelledAt: row.cancelled_at,
        shippedAt: row.shipped_at,
        deliveredAt: row.delivered_at,
    });
}
function toOrderLine(row) {
    return OrderLine.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        orderId: row.order_id,
        productId: row.product_id,
        offerId: row.offer_id,
        stockLocationId: row.stock_location_id,
        merchantSku: row.merchant_sku,
        productTypeSnapshot: row.product_type_snapshot,
        quantity: row.quantity,
        cancelledQuantity: row.cancelled_quantity,
        shippedQuantity: row.shipped_quantity,
        returnedQuantity: row.returned_quantity,
        unitPriceMinor: row.unit_price_minor,
        discountMinor: row.discount_minor,
        taxMinor: row.tax_minor,
        lineTotalMinor: row.line_total_minor,
        currency: row.currency,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
function toCustomerSnapshot(row) {
    return CustomerSnapshot.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        orderId: row.order_id,
        externalCustomerReference: row.external_customer_reference,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        companyName: row.company_name,
        billingAddress: normalizeAddress(row.billing_address),
        shippingAddress: normalizeAddress(row.shipping_address),
        metadata: row.metadata,
        createdAt: row.created_at,
    });
}
export class PostgresOrderRepository {
    async findById(queryable, tenantId, orderId) {
        const result = await queryable.query(`SELECT ${orderSelect} FROM orders WHERE tenant_id = $1 AND id = $2`, [tenantId, orderId], { operation: 'orders.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toOrder(parseOrThrow(orderRowSchema, row, 'orders row'));
    }
    async lockOrderForUpdate(transaction, tenantId, orderId) {
        const result = await transaction.query(`SELECT ${orderSelect}
       FROM orders
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`, [tenantId, orderId], { operation: 'orders.lock_for_update' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toOrder(parseOrThrow(orderRowSchema, row, 'orders row'));
    }
    async findByOrderNumber(queryable, tenantId, orderNumber) {
        const result = await queryable.query(`SELECT ${orderSelect} FROM orders WHERE tenant_id = $1 AND order_number = $2`, [tenantId, orderNumber], { operation: 'orders.find_by_order_number' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toOrder(parseOrThrow(orderRowSchema, row, 'orders row'));
    }
    async findByChannelAndExternalReference(queryable, tenantId, channelId, externalOrderReference) {
        const result = await queryable.query(`SELECT ${orderSelect}
       FROM orders
       WHERE tenant_id = $1 AND channel_id = $2 AND external_order_reference = $3`, [tenantId, channelId, externalOrderReference], { operation: 'orders.find_by_channel_and_external_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toOrder(parseOrThrow(orderRowSchema, row, 'orders row'));
    }
    async lockByChannelAndExternalReferenceForUpdate(transaction, tenantId, channelId, externalOrderReference) {
        const result = await transaction.query(`SELECT ${orderSelect}
       FROM orders
       WHERE tenant_id = $1 AND channel_id = $2 AND external_order_reference = $3
       FOR UPDATE`, [tenantId, channelId, externalOrderReference], { operation: 'orders.lock_by_channel_and_external_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toOrder(parseOrThrow(orderRowSchema, row, 'orders row'));
    }
    buildListConditions(tenantId, filters) {
        const conditions = ['o.tenant_id = $1'];
        const params = [tenantId];
        let paramIndex = 2;
        if (filters.status !== undefined) {
            conditions.push(`o.status = $${paramIndex++}`);
            params.push(filters.status);
        }
        if (filters.statuses !== undefined) {
            if (filters.statuses.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`o.status = ANY($${paramIndex++}::text[])`);
                params.push(filters.statuses);
            }
        }
        if (filters.orderNumbers !== undefined) {
            if (filters.orderNumbers.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`o.order_number = ANY($${paramIndex++}::text[])`);
                params.push(filters.orderNumbers);
            }
        }
        if (filters.externalOrderReferences !== undefined) {
            if (filters.externalOrderReferences.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`o.external_order_reference = ANY($${paramIndex++}::text[])`);
                params.push(filters.externalOrderReferences);
            }
        }
        if (filters.channelId !== undefined) {
            conditions.push(`o.channel_id = $${paramIndex++}`);
            params.push(filters.channelId);
        }
        if (filters.externalOrderReference !== undefined) {
            conditions.push(`o.external_order_reference = $${paramIndex++}`);
            params.push(filters.externalOrderReference);
        }
        if (filters.orderNumber !== undefined) {
            conditions.push(`o.order_number = $${paramIndex++}`);
            params.push(filters.orderNumber);
        }
        if (filters.createdAfter !== undefined) {
            conditions.push(`o.created_at >= $${paramIndex++}`);
            params.push(filters.createdAfter);
        }
        if (filters.createdBefore !== undefined) {
            conditions.push(`o.created_at < $${paramIndex++}`);
            params.push(filters.createdBefore);
        }
        if (filters.updatedAfter !== undefined) {
            conditions.push(`o.updated_at >= $${paramIndex++}`);
            params.push(filters.updatedAfter);
        }
        if (filters.updatedBefore !== undefined) {
            conditions.push(`o.updated_at < $${paramIndex++}`);
            params.push(filters.updatedBefore);
        }
        if (filters.stockLocationId !== undefined) {
            conditions.push(`EXISTS (
         SELECT 1 FROM order_lines ol
         WHERE ol.tenant_id = o.tenant_id
           AND ol.order_id = o.id
           AND ol.stock_location_id = $${paramIndex++}
       )`);
            params.push(filters.stockLocationId);
        }
        return { conditions, params, nextParamIndex: paramIndex };
    }
    async list(queryable, tenantId, filters, limit, cursor) {
        const conditions = ['tenant_id = $1'];
        const params = [tenantId];
        let paramIndex = 2;
        if (filters.status !== undefined) {
            conditions.push(`status = $${paramIndex++}`);
            params.push(filters.status);
        }
        if (filters.channelId !== undefined) {
            conditions.push(`channel_id = $${paramIndex++}`);
            params.push(filters.channelId);
        }
        if (filters.externalOrderReference !== undefined) {
            conditions.push(`external_order_reference = $${paramIndex++}`);
            params.push(filters.externalOrderReference);
        }
        if (filters.orderNumber !== undefined) {
            conditions.push(`order_number = $${paramIndex++}`);
            params.push(filters.orderNumber);
        }
        if (filters.createdAfter !== undefined) {
            conditions.push(`created_at >= $${paramIndex++}`);
            params.push(filters.createdAfter);
        }
        if (filters.createdBefore !== undefined) {
            conditions.push(`created_at < $${paramIndex++}`);
            params.push(filters.createdBefore);
        }
        if (cursor !== undefined && cursor.length >= 2) {
            conditions.push(`(created_at, id) < ($${paramIndex++}::timestamptz, $${paramIndex++}::uuid)`);
            params.push(cursor[0], cursor[1]);
        }
        params.push(limit);
        const result = await queryable.query(`SELECT ${orderSelect}
       FROM orders
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${paramIndex}`, params, { operation: 'orders.list' });
        return result.rows.map((row) => toOrder(parseOrThrow(orderRowSchema, row, 'orders row')));
    }
    async count(queryable, tenantId, filters) {
        const { conditions, params } = this.buildListConditions(tenantId, filters);
        const result = await queryable.query(`SELECT COUNT(*)::int AS total
       FROM orders o
       WHERE ${conditions.join(' AND ')}`, params, { operation: 'orders.count' });
        const row = result.rows[0];
        return Number(row?.total ?? 0);
    }
    async listPage(queryable, tenantId, filters, page, pageSize) {
        const { conditions, params, nextParamIndex } = this.buildListConditions(tenantId, filters);
        const offset = (page - 1) * pageSize;
        const limitParam = nextParamIndex;
        const offsetParam = nextParamIndex + 1;
        const listParams = [...params, pageSize, offset];
        const result = await queryable.query(`SELECT ${orderSelectAliased}
       FROM orders o
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`, listParams, { operation: 'orders.list_page' });
        return result.rows.map((row) => toOrder(parseOrThrow(orderRowSchema, row, 'orders row')));
    }
    async insertOrder(transaction, order) {
        const p = order.toProps();
        await transaction.query(`INSERT INTO orders (
         id, tenant_id, channel_id, external_order_reference, order_number, status, currency,
         subtotal_minor, discount_minor, tax_minor, shipping_minor, total_minor,
         created_at, updated_at, confirmed_at, cancelled_at, shipped_at, delivered_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [
            p.id,
            p.tenantId,
            p.channelId,
            p.externalOrderReference,
            p.orderNumber,
            p.status,
            p.currency,
            p.subtotalMinor,
            p.discountMinor,
            p.taxMinor,
            p.shippingMinor,
            p.totalMinor,
            p.createdAt,
            p.updatedAt,
            p.confirmedAt,
            p.cancelledAt,
            p.shippedAt,
            p.deliveredAt,
        ], { operation: 'orders.insert' });
    }
    async updateOrder(transaction, order) {
        const p = order.toProps();
        await transaction.query(`UPDATE orders SET
         status = $3, updated_at = $4, confirmed_at = $5, cancelled_at = $6,
         shipped_at = $7, delivered_at = $8
       WHERE tenant_id = $1 AND id = $2`, [
            p.tenantId,
            p.id,
            p.status,
            p.updatedAt,
            p.confirmedAt,
            p.cancelledAt,
            p.shippedAt,
            p.deliveredAt,
        ], { operation: 'orders.update' });
    }
    async insertOrderLine(transaction, line) {
        const p = line.toProps();
        await transaction.query(`INSERT INTO order_lines (
         id, tenant_id, order_id, product_id, offer_id, stock_location_id, merchant_sku,
         product_type_snapshot, quantity, cancelled_quantity, shipped_quantity, returned_quantity,
         unit_price_minor, discount_minor, tax_minor, line_total_minor, currency, status,
         created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`, [
            p.id,
            p.tenantId,
            p.orderId,
            p.productId,
            p.offerId,
            p.stockLocationId,
            p.merchantSku,
            p.productTypeSnapshot,
            p.quantity,
            p.cancelledQuantity,
            p.shippedQuantity,
            p.returnedQuantity,
            p.unitPriceMinor,
            p.discountMinor,
            p.taxMinor,
            p.lineTotalMinor,
            p.currency,
            p.status,
            p.createdAt,
            p.updatedAt,
        ], { operation: 'order_lines.insert' });
    }
    async updateOrderLine(transaction, line) {
        const p = line.toProps();
        await transaction.query(`UPDATE order_lines SET
         cancelled_quantity = $3, shipped_quantity = $4, returned_quantity = $5,
         status = $6, updated_at = $7
       WHERE tenant_id = $1 AND id = $2`, [
            p.tenantId,
            p.id,
            p.cancelledQuantity,
            p.shippedQuantity,
            p.returnedQuantity,
            p.status,
            p.updatedAt,
        ], { operation: 'order_lines.update' });
    }
    async updateOrderLineReturnedQuantity(transaction, tenantId, orderLineId, returnedQuantity, updatedAt) {
        await transaction.query(`UPDATE order_lines
       SET returned_quantity = $3, updated_at = $4
       WHERE tenant_id = $1 AND id = $2`, [tenantId, orderLineId, returnedQuantity, updatedAt], { operation: 'order_lines.update_returned_quantity' });
    }
    async listOrderLines(queryable, tenantId, orderId) {
        const result = await queryable.query(`SELECT ${orderLineSelect} FROM order_lines WHERE tenant_id = $1 AND order_id = $2 ORDER BY created_at`, [tenantId, orderId], { operation: 'order_lines.list' });
        return result.rows.map((row) => toOrderLine(parseOrThrow(orderLineRowSchema, row, 'order_lines row')));
    }
    async lockOrderLinesForUpdate(transaction, tenantId, orderId) {
        const result = await transaction.query(`SELECT ${orderLineSelect}
       FROM order_lines
       WHERE tenant_id = $1 AND order_id = $2
       FOR UPDATE`, [tenantId, orderId], { operation: 'order_lines.lock_for_update' });
        return result.rows.map((row) => toOrderLine(parseOrThrow(orderLineRowSchema, row, 'order_lines row')));
    }
    async lockOrderLineForUpdate(transaction, tenantId, orderLineId) {
        const result = await transaction.query(`SELECT ${orderLineSelect}
       FROM order_lines
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`, [tenantId, orderLineId], { operation: 'order_lines.lock_one_for_update' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toOrderLine(parseOrThrow(orderLineRowSchema, row, 'order_lines row'));
    }
    async insertCustomerSnapshot(transaction, snapshot) {
        const p = snapshot.toProps();
        await transaction.query(`INSERT INTO order_customer_snapshots (
         id, tenant_id, order_id, external_customer_reference, first_name, last_name,
         email, phone, company_name, billing_address, shipping_address, metadata, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
            p.id,
            p.tenantId,
            p.orderId,
            p.externalCustomerReference,
            p.firstName,
            p.lastName,
            p.email,
            p.phone,
            p.companyName,
            p.billingAddress === null ? null : JSON.stringify(p.billingAddress),
            p.shippingAddress === null ? null : JSON.stringify(p.shippingAddress),
            JSON.stringify(p.metadata),
            p.createdAt,
        ], { operation: 'order_customer_snapshots.insert' });
    }
    async findCustomerSnapshot(queryable, tenantId, orderId) {
        const result = await queryable.query(`SELECT id, tenant_id, order_id, external_customer_reference, first_name, last_name,
              email, phone, company_name, billing_address, shipping_address, metadata, created_at
       FROM order_customer_snapshots
       WHERE tenant_id = $1 AND order_id = $2`, [tenantId, orderId], { operation: 'order_customer_snapshots.find' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toCustomerSnapshot(parseOrThrow(customerRowSchema, row, 'order_customer_snapshots row'));
    }
    async allocateOrderNumber(transaction, tenantId) {
        const result = await transaction.query(`INSERT INTO tenant_order_sequences (tenant_id, last_value)
       VALUES ($1, 1)
       ON CONFLICT (tenant_id) DO UPDATE
         SET last_value = tenant_order_sequences.last_value + 1,
             updated_at = now()
       RETURNING last_value`, [tenantId], { operation: 'orders.allocate_number' });
        const row = result.rows[0];
        if (row === undefined) {
            throw new Error('Failed to allocate order number');
        }
        const seq = Number(row.last_value);
        return `ORD-${String(seq).padStart(8, '0')}`;
    }
}
export function orderListCursor(order) {
    return encodeCursor([order.createdAt.toISOString(), order.id]);
}
