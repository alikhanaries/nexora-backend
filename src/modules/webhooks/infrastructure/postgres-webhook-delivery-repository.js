import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { WebhookDelivery } from '../domain/webhook-delivery.js';
import { WebhookDeliveryStatus } from '../domain/webhook-delivery-status.js';

const deliveryRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    subscription_id: z.string().uuid(),
    event_id: z.string().uuid(),
    event_type: z.string(),
    status: z.enum([
        WebhookDeliveryStatus.PENDING,
        WebhookDeliveryStatus.DELIVERING,
        WebhookDeliveryStatus.DELIVERED,
        WebhookDeliveryStatus.FAILED,
        WebhookDeliveryStatus.DEAD_LETTERED,
    ]),
    attempt_count: z.number().int(),
    next_attempt_at: z.date().nullable(),
    last_http_status: z.number().int().nullable(),
    last_error: z.string().nullable(),
    delivered_at: z.date().nullable(),
    created_at: z.date(),
});

const deliverySelect = `id, tenant_id, subscription_id, event_id, event_type, status, attempt_count, next_attempt_at, last_http_status, last_error, delivered_at, created_at`;

function toDelivery(row) {
    return WebhookDelivery.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        subscriptionId: row.subscription_id,
        eventId: row.event_id,
        eventType: row.event_type,
        status: row.status,
        attemptCount: row.attempt_count,
        nextAttemptAt: row.next_attempt_at,
        lastHttpStatus: row.last_http_status,
        lastError: row.last_error,
        deliveredAt: row.delivered_at,
        createdAt: row.created_at,
    });
}

export class PostgresWebhookDeliveryRepository {
    async insert(queryable, delivery) {
        await queryable.query(`INSERT INTO webhook_deliveries
         (id, tenant_id, subscription_id, event_id, event_type, status, attempt_count, next_attempt_at, last_http_status, last_error, delivered_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
            delivery.id,
            delivery.tenantId,
            delivery.subscriptionId,
            delivery.eventId,
            delivery.eventType,
            delivery.status,
            delivery.attemptCount,
            delivery.nextAttemptAt,
            delivery.lastHttpStatus,
            delivery.lastError,
            delivery.deliveredAt,
            delivery.createdAt,
        ], { operation: 'webhooks.deliveries.insert' });
    }
    async findById(queryable, tenantId, deliveryId) {
        const result = await queryable.query(`SELECT ${deliverySelect}
       FROM webhook_deliveries
       WHERE tenant_id = $1 AND id = $2`, [tenantId, deliveryId], { operation: 'webhooks.deliveries.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toDelivery(parseOrThrow(deliveryRowSchema, row, 'webhook_deliveries row'));
    }
    async findBySubscriptionAndEventId(queryable, tenantId, subscriptionId, eventId) {
        const result = await queryable.query(`SELECT ${deliverySelect}
       FROM webhook_deliveries
       WHERE tenant_id = $1 AND subscription_id = $2 AND event_id = $3`, [tenantId, subscriptionId, eventId], { operation: 'webhooks.deliveries.find_by_subscription_event' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toDelivery(parseOrThrow(deliveryRowSchema, row, 'webhook_deliveries row'));
    }
    async update(queryable, delivery, options = {}) {
        const params = [
            delivery.tenantId,
            delivery.id,
            delivery.status,
            delivery.attemptCount,
            delivery.nextAttemptAt,
            delivery.lastHttpStatus,
            delivery.lastError,
            delivery.deliveredAt,
        ];
        let sql = `UPDATE webhook_deliveries
       SET status = $3,
           attempt_count = $4,
           next_attempt_at = $5,
           last_http_status = $6,
           last_error = $7,
           delivered_at = $8
       WHERE tenant_id = $1 AND id = $2`;
        if (options.expectedStatuses !== undefined && options.expectedStatuses.length > 0) {
            params.push(options.expectedStatuses);
            sql += ` AND status = ANY($${params.length}::text[])`;
        }
        const result = await queryable.query(sql, params, { operation: 'webhooks.deliveries.update' });
        return result.rowCount > 0;
    }
    /**
     * Atomically claims a delivery attempt and increments attempt_count.
     *
     * Reclaims stale DELIVERING rows once their lease expires.
     */
    async claimAttempt(queryable, tenantId, deliveryId, leaseSeconds) {
        const result = await queryable.query(`UPDATE webhook_deliveries
       SET status = $4,
           attempt_count = attempt_count + 1,
           next_attempt_at = now() + make_interval(secs => $5)
       WHERE tenant_id = $1
         AND id = $2
         AND (
           status = ANY($3::text[])
           OR (status = $4 AND next_attempt_at IS NOT NULL AND next_attempt_at <= now())
         )
       RETURNING ${deliverySelect}`, [
            tenantId,
            deliveryId,
            [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED],
            WebhookDeliveryStatus.DELIVERING,
            leaseSeconds,
        ], { operation: 'webhooks.deliveries.claim_attempt' });
        const row = result.rows[0];
        if (row === undefined) {
            return null;
        }
        return toDelivery(parseOrThrow(deliveryRowSchema, row, 'webhook_deliveries row'));
    }
    async listBySubscription(queryable, tenantId, subscriptionId, input = {}) {
        const limit = input.limit ?? 100;
        const result = await queryable.query(`SELECT ${deliverySelect}
       FROM webhook_deliveries
       WHERE tenant_id = $1 AND subscription_id = $2
       ORDER BY created_at DESC, id DESC
       LIMIT $3`, [tenantId, subscriptionId, limit], { operation: 'webhooks.deliveries.list_by_subscription' });
        return result.rows.map((row) => toDelivery(parseOrThrow(deliveryRowSchema, row, 'webhook_deliveries row')));
    }
    async listPage(queryable, tenantId, subscriptionId, filter, limit, cursorCreatedAt, cursorId) {
        const conditions = ['tenant_id = $1', 'subscription_id = $2'];
        const params = [tenantId, subscriptionId];
        if (filter.status !== undefined) {
            params.push(filter.status);
            conditions.push(`status = $${params.length}`);
        }
        if (filter.eventType !== undefined) {
            params.push(filter.eventType);
            conditions.push(`event_type = $${params.length}`);
        }
        if (cursorCreatedAt !== null && cursorId !== null) {
            params.push(cursorCreatedAt, cursorId);
            conditions.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
        }
        params.push(limit);
        const limitParam = `$${params.length}`;
        const result = await queryable.query(`SELECT ${deliverySelect}
       FROM webhook_deliveries
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limitParam}`, params, { operation: 'webhooks.deliveries.list_page' });
        return result.rows.map((row) => toDelivery(parseOrThrow(deliveryRowSchema, row, 'webhook_deliveries row')));
    }
}
