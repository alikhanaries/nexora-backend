import { clampBatchSize } from '../../shared/pagination/index.js';

/**
 * Tenant-aware retention sweeps for terminal webhook delivery ledger rows.
 */
export class WebhookDeliveryRetention {
    /** @param {import('./postgres-database.js').PostgresDatabase} database */
    constructor(database) {
        this.database = database;
    }

    /**
     * Deletes up to `batchSize` terminal deliveries older than `cutoff`.
     *
     * Eligible: DELIVERED (by delivered_at, else created_at) and DEAD_LETTERED (by created_at).
     * Never deletes PENDING, DELIVERING, or FAILED (retryable) rows.
     */
    async purgeTerminalBefore(cutoff, batchSize) {
        const limit = clampBatchSize(batchSize);
        if (limit === 0) {
            return 0;
        }
        const tenants = await this.database.query(`SELECT id FROM tenants ORDER BY id`, [], {
            operation: 'webhook_deliveries.retention.list_tenants',
        });
        let remaining = limit;
        let total = 0;
        for (const row of tenants.rows) {
            if (remaining === 0) {
                break;
            }
            const tenantId = String(row['id']);
            const deleted = await this.database.execute(async (tx) => {
                const result = await tx.query(`DELETE FROM webhook_deliveries
           WHERE id IN (
             SELECT id
             FROM webhook_deliveries
             WHERE (
               status = 'DELIVERED'
               AND COALESCE(delivered_at, created_at) < $1
             ) OR (
               status = 'DEAD_LETTERED'
               AND created_at < $1
             )
             ORDER BY created_at, id
             LIMIT $2
           )`, [cutoff, remaining], { operation: 'webhook_deliveries.purge_terminal' });
                return result.rowCount ?? 0;
            }, { tenantId });
            total += deleted;
            remaining -= deleted;
        }
        return total;
    }
}
