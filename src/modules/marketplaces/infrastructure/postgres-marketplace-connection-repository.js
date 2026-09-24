import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { MarketplaceConnectionStatus } from '../domain/marketplace-connection-status.js';

const rowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    channel_id: z.string().uuid(),
    marketplace_key: z.string(),
    credentials_ciphertext: z.string(),
    configuration: z.record(z.unknown()),
    status: z.enum([MarketplaceConnectionStatus.ACTIVE, MarketplaceConnectionStatus.DISABLED]),
    created_at: z.date(),
    updated_at: z.date(),
});

export class PostgresMarketplaceConnectionRepository {
    /**
     * @param {object} queryable
     * @param {string} tenantId
     * @param {string} channelId
     */
    async findActiveByChannel(queryable, tenantId, channelId) {
        const result = await queryable.query(`SELECT id, tenant_id, channel_id, marketplace_key, credentials_ciphertext,
              configuration, status, created_at, updated_at
       FROM marketplace_connections
       WHERE tenant_id = $1 AND channel_id = $2 AND status = 'ACTIVE'
       ORDER BY updated_at DESC
       LIMIT 1`, [tenantId, channelId], { operation: 'marketplace_connections.find_active_by_channel' });
        const row = result.rows[0];
        if (row === undefined) {
            return null;
        }
        return parseOrThrow(rowSchema, row, 'marketplace_connections row');
    }

    /**
     * @param {object} transaction
     * @param {object} input
     */
    async upsertActive(transaction, input) {
        await transaction.query(`UPDATE marketplace_connections
       SET status = 'DISABLED', updated_at = now()
       WHERE tenant_id = $1 AND channel_id = $2 AND marketplace_key = $3 AND status = 'ACTIVE'`, [
            input.tenantId,
            input.channelId,
            input.marketplaceKey,
        ], { operation: 'marketplace_connections.disable_previous' });
        await transaction.query(`INSERT INTO marketplace_connections (
         id, tenant_id, channel_id, marketplace_key, credentials_ciphertext, configuration, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'ACTIVE', now(), now())`, [
            input.id,
            input.tenantId,
            input.channelId,
            input.marketplaceKey,
            input.credentialsCiphertext,
            JSON.stringify(input.configuration ?? {}),
        ], { operation: 'marketplace_connections.insert' });
    }

    /**
     * @param {object} queryable
     * @param {string} tenantId
     * @param {string} channelId
     */
    async findByChannel(queryable, tenantId, channelId) {
        const result = await queryable.query(`SELECT id, tenant_id, channel_id, marketplace_key, credentials_ciphertext,
              configuration, status, created_at, updated_at
       FROM marketplace_connections
       WHERE tenant_id = $1 AND channel_id = $2
       ORDER BY created_at DESC
       LIMIT 1`, [tenantId, channelId], { operation: 'marketplace_connections.find_by_channel' });
        const row = result.rows[0];
        if (row === undefined) {
            return null;
        }
        return parseOrThrow(rowSchema, row, 'marketplace_connections row');
    }

    /**
     * @param {object} transaction
     * @param {string} tenantId
     * @param {string} channelId
     */
    async disableByChannel(transaction, tenantId, channelId) {
        await transaction.query(`UPDATE marketplace_connections
       SET status = 'DISABLED', updated_at = now()
       WHERE tenant_id = $1 AND channel_id = $2 AND status = 'ACTIVE'`, [tenantId, channelId], {
            operation: 'marketplace_connections.disable_by_channel',
        });
    }

}
