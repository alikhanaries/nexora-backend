import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { InventoryBalance } from '../domain/inventory-balance.js';
import { InventoryReservation } from '../domain/reservation.js';
import { ReservationStatus } from '../domain/reservation-status.js';
const balanceRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    stock_location_id: z.string().uuid(),
    product_id: z.string().uuid(),
    on_hand: z.number().int(),
    reserved: z.number().int(),
    available: z.number().int(),
    created_at: z.date(),
    updated_at: z.date(),
});
const reservationRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    stock_location_id: z.string().uuid(),
    product_id: z.string().uuid(),
    reference_type: z.string(),
    reference_id: z.string(),
    quantity: z.number().int(),
    status: z.enum([ReservationStatus.ACTIVE, ReservationStatus.RELEASED]),
    created_at: z.date(),
    released_at: z.date().nullable(),
});
function toBalance(row) {
    return InventoryBalance.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        stockLocationId: row.stock_location_id,
        productId: row.product_id,
        onHand: row.on_hand,
        reserved: row.reserved,
        available: row.available,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
function toReservation(row) {
    return InventoryReservation.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        stockLocationId: row.stock_location_id,
        productId: row.product_id,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        quantity: row.quantity,
        status: row.status,
        createdAt: row.created_at,
        releasedAt: row.released_at,
    });
}
export class PostgresInventoryRepository {
    async listBalances(queryable, tenantId, filters) {
        const conditions = ['tenant_id = $1'];
        const params = [tenantId];
        if (filters.productId !== undefined) {
            params.push(filters.productId);
            conditions.push(`product_id = $${params.length}`);
        }
        if (filters.stockLocationId !== undefined) {
            params.push(filters.stockLocationId);
            conditions.push(`stock_location_id = $${params.length}`);
        }
        const result = await queryable.query(`SELECT id, tenant_id, stock_location_id, product_id, on_hand, reserved, available,
              created_at, updated_at
       FROM inventory_balances
       WHERE ${conditions.join(' AND ')}
       ORDER BY product_id ASC, stock_location_id ASC`, params, { operation: 'inventory.balances.list' });
        return result.rows.map((row) => toBalance(parseOrThrow(balanceRowSchema, row, 'inventory_balances row')));
    }
    async ensureBalanceRow(transaction, tenantId, stockLocationId, productId, balanceId) {
        await transaction.query(`INSERT INTO inventory_balances
         (id, tenant_id, stock_location_id, product_id, on_hand, reserved, available, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 0, 0, 0, now(), now())
       ON CONFLICT (tenant_id, stock_location_id, product_id) DO NOTHING`, [balanceId, tenantId, stockLocationId, productId], { operation: 'inventory.balances.ensure' });
    }
    async lockBalanceForUpdate(transaction, tenantId, stockLocationId, productId) {
        await this.ensureBalanceRow(transaction, tenantId, stockLocationId, productId, randomUUID());
        const result = await transaction.query(`SELECT id, tenant_id, stock_location_id, product_id, on_hand, reserved, available,
              created_at, updated_at
       FROM inventory_balances
       WHERE tenant_id = $1 AND stock_location_id = $2 AND product_id = $3
       FOR UPDATE`, [tenantId, stockLocationId, productId], { operation: 'inventory.balances.lock_for_update' });
        const row = result.rows[0];
        if (row === undefined) {
            throw new Error('Inventory balance row missing after ensure');
        }
        return toBalance(parseOrThrow(balanceRowSchema, row, 'inventory_balances row'));
    }
    async updateBalance(transaction, balanceId, values, updatedAt) {
        InventoryBalance.assertInvariant(values.onHand, values.reserved, values.available);
        await transaction.query(`UPDATE inventory_balances
       SET on_hand = $2, reserved = $3, available = $4, updated_at = $5
       WHERE id = $1`, [balanceId, values.onHand, values.reserved, values.available, updatedAt], { operation: 'inventory.balances.update' });
    }
    async insertMovement(transaction, input) {
        const values = [
            input.id,
            input.tenantId,
            input.stockLocationId,
            input.productId,
            input.movementType,
            input.quantity,
            input.referenceType ?? null,
            input.referenceId ?? null,
            input.idempotencyKey ?? null,
            JSON.stringify(input.metadata ?? {}),
            input.occurredAt ?? new Date(),
        ];
        const hasIdempotencyKey = input.idempotencyKey !== undefined &&
            input.idempotencyKey !== null &&
            input.referenceType !== undefined &&
            input.referenceType !== null &&
            input.referenceId !== undefined &&
            input.referenceId !== null;
        const sql = hasIdempotencyKey
            ? `INSERT INTO inventory_movements
           (id, tenant_id, stock_location_id, product_id, movement_type, quantity,
            reference_type, reference_id, idempotency_key, metadata, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
         ON CONFLICT (tenant_id, reference_type, reference_id, movement_type, idempotency_key)
         WHERE idempotency_key IS NOT NULL
           AND reference_type IS NOT NULL
           AND reference_id IS NOT NULL
         DO NOTHING
         RETURNING id`
            : `INSERT INTO inventory_movements
           (id, tenant_id, stock_location_id, product_id, movement_type, quantity,
            reference_type, reference_id, idempotency_key, metadata, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
         RETURNING id`;
        const result = await transaction.query(sql, values, {
            operation: 'inventory.movements.insert',
        });
        return result.rows.length > 0;
    }
    async insertReservation(transaction, input) {
        const insertResult = await transaction.query(`INSERT INTO inventory_reservations
         (id, tenant_id, stock_location_id, product_id, reference_type, reference_id, quantity, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
       ON CONFLICT (tenant_id, reference_type, reference_id, stock_location_id, product_id)
       DO NOTHING
       RETURNING id, tenant_id, stock_location_id, product_id, reference_type, reference_id,
                 quantity, status, created_at, released_at`, [
            input.id,
            input.tenantId,
            input.stockLocationId,
            input.productId,
            input.referenceType,
            input.referenceId,
            input.quantity,
        ], { operation: 'inventory.reservations.insert' });
        if (insertResult.rows.length > 0) {
            const row = parseOrThrow(reservationRowSchema, insertResult.rows[0], 'inventory_reservations row');
            return { inserted: true, reservation: toReservation(row) };
        }
        const existing = await this.findReservationByReference(transaction, input.tenantId, input.referenceType, input.referenceId, input.stockLocationId, input.productId);
        if (existing === null) {
            throw new Error('Reservation conflict without existing row');
        }
        return { inserted: false, reservation: existing };
    }
    async findReservationByReference(transaction, tenantId, referenceType, referenceId, stockLocationId, productId) {
        const result = await transaction.query(`SELECT id, tenant_id, stock_location_id, product_id, reference_type, reference_id,
              quantity, status, created_at, released_at
       FROM inventory_reservations
       WHERE tenant_id = $1
         AND reference_type = $2
         AND reference_id = $3
         AND stock_location_id = $4
         AND product_id = $5`, [tenantId, referenceType, referenceId, stockLocationId, productId], { operation: 'inventory.reservations.find_by_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toReservation(parseOrThrow(reservationRowSchema, row, 'inventory_reservations row'));
    }
    async markReservationReleased(transaction, reservationId, releasedAt) {
        await transaction.query(`UPDATE inventory_reservations
       SET status = 'RELEASED', released_at = $2
       WHERE id = $1 AND status = 'ACTIVE'`, [reservationId, releasedAt], { operation: 'inventory.reservations.release' });
    }
    async updateReservationQuantity(transaction, reservationId, quantity, releasedAt) {
        if (quantity <= 0) {
            await this.markReservationReleased(transaction, reservationId, releasedAt);
            return;
        }
        await transaction.query(`UPDATE inventory_reservations
       SET quantity = $2
       WHERE id = $1 AND status = 'ACTIVE'`, [reservationId, quantity], { operation: 'inventory.reservations.update_quantity' });
    }
    async findMovementByIdempotency(transaction, tenantId, referenceType, referenceId, movementType, idempotencyKey) {
        const result = await transaction.query(`SELECT id
       FROM inventory_movements
       WHERE tenant_id = $1
         AND reference_type = $2
         AND reference_id = $3
         AND movement_type = $4
         AND idempotency_key = $5`, [tenantId, referenceType, referenceId, movementType, idempotencyKey], { operation: 'inventory.movements.find_by_idempotency' });
        return result.rows[0]?.id ?? null;
    }
}
