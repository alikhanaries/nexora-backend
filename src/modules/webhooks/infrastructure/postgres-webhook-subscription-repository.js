import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { WebhookSubscription } from '../domain/webhook-subscription.js';
import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';

const subscriptionRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    url: z.string(),
    description: z.string().nullable(),
    secret_ciphertext: z.string(),
    event_types: z.array(z.string()),
    status: z.enum([
        WebhookSubscriptionStatus.ACTIVE,
        WebhookSubscriptionStatus.DISABLED,
        WebhookSubscriptionStatus.DELETED,
    ]),
    created_by: z.string().nullable(),
    created_at: z.date(),
    updated_at: z.date(),
});

const subscriptionSelect = `id, tenant_id, url, description, secret_ciphertext, event_types, status, created_by, created_at, updated_at`;

function toSubscription(row) {
    return WebhookSubscription.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        url: row.url,
        description: row.description,
        secretCiphertext: row.secret_ciphertext,
        eventTypes: row.event_types,
        status: row.status,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}

export class PostgresWebhookSubscriptionRepository {
    async insert(queryable, subscription) {
        await queryable.query(`INSERT INTO webhook_subscriptions
         (id, tenant_id, url, description, secret_ciphertext, event_types, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
            subscription.id,
            subscription.tenantId,
            subscription.url,
            subscription.description,
            subscription.secretCiphertext,
            subscription.eventTypes,
            subscription.status,
            subscription.createdBy,
            subscription.createdAt,
            subscription.updatedAt,
        ], { operation: 'webhooks.subscriptions.insert' });
    }
    async findById(queryable, tenantId, subscriptionId) {
        const result = await queryable.query(`SELECT ${subscriptionSelect}
       FROM webhook_subscriptions
       WHERE tenant_id = $1 AND id = $2`, [tenantId, subscriptionId], { operation: 'webhooks.subscriptions.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toSubscription(parseOrThrow(subscriptionRowSchema, row, 'webhook_subscriptions row'));
    }
    async list(queryable, tenantId, input = {}) {
        const params = [tenantId];
        let sql = `SELECT ${subscriptionSelect}
       FROM webhook_subscriptions
       WHERE tenant_id = $1`;
        if (input.statuses !== undefined && input.statuses.length > 0) {
            params.push(input.statuses);
            sql += ` AND status = ANY($${params.length}::text[])`;
        }
        sql += ' ORDER BY created_at DESC, id DESC';
        const result = await queryable.query(sql, params, { operation: 'webhooks.subscriptions.list' });
        return result.rows.map((row) => toSubscription(parseOrThrow(subscriptionRowSchema, row, 'webhook_subscriptions row')));
    }
    async update(queryable, subscription) {
        await queryable.query(`UPDATE webhook_subscriptions
       SET url = $3,
           description = $4,
           event_types = $5,
           status = $6,
           updated_at = $7
       WHERE tenant_id = $1 AND id = $2`, [
            subscription.tenantId,
            subscription.id,
            subscription.url,
            subscription.description,
            subscription.eventTypes,
            subscription.status,
            subscription.updatedAt,
        ], { operation: 'webhooks.subscriptions.update' });
    }
}
