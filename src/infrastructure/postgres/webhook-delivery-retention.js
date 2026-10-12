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
        const eligibleTenants = await this.database.executeAsOwner(async (tx) => tx.query(`SELECT DISTINCT tenant_id
       FROM webhook_deliveries
       WHERE (
         status = 'DELIVERED'
         AND COALESCE(delivered_at, created_at) < $1
       ) OR (
         status = 'DEAD_LETTERED'
         AND created_at < $1
       )
       ORDER BY tenant_id`, [cutoff], { operation: 'webhook_deliveries.retention.list_eligible_tenants' }));
        if (eligibleTenants.rows.length === 0) {
            return 0;
        }
        let remaining = limit;
        let total = 0;
        for (const row of eligibleTenants.rows) {
            if (remaining === 0) {
                break;
            }
            const tenantId = String(row['tenant_id']);
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
