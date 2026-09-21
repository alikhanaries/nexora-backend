import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { Channel } from '../domain/channel.js';
import { ChannelStatus } from '../domain/channel-status.js';
const channelRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    marketplace_id: z.string().uuid(),
    name: z.string(),
    external_reference: z.string().nullable(),
    status: z.enum([ChannelStatus.ACTIVE, ChannelStatus.INACTIVE, ChannelStatus.SUSPENDED]),
    configuration_reference: z.string().nullable(),
    created_at: z.date(),
    updated_at: z.date(),
});
function toChannel(row) {
    return Channel.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        marketplaceId: row.marketplace_id,
        name: row.name,
        externalReference: row.external_reference,
        status: row.status,
        configurationReference: row.configuration_reference,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
export class PostgresChannelRepository {
    async findById(queryable, tenantId, channelId) {
        const result = await queryable.query(`SELECT id, tenant_id, marketplace_id, name, external_reference, status,
              configuration_reference, created_at, updated_at
       FROM channels
       WHERE tenant_id = $1 AND id = $2`, [tenantId, channelId], { operation: 'channels.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toChannel(parseOrThrow(channelRowSchema, row, 'channels row'));
    }
    async list(queryable, tenantId, filters) {
        const conditions = ['tenant_id = $1'];
        const parameters = [tenantId];
        if (filters.status !== undefined) {
            parameters.push(filters.status);
            conditions.push(`status = $${parameters.length}`);
        }
        if (filters.marketplaceId !== undefined) {
            parameters.push(filters.marketplaceId);
            conditions.push(`marketplace_id = $${parameters.length}`);
        }
        const result = await queryable.query(`SELECT id, tenant_id, marketplace_id, name, external_reference, status,
              configuration_reference, created_at, updated_at
       FROM channels
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`, parameters, { operation: 'channels.list' });
        return result.rows.map((row) => toChannel(parseOrThrow(channelRowSchema, row, 'channels row')));
    }
    async insert(transaction, channel) {
        await transaction.query(`INSERT INTO channels (
         id, tenant_id, marketplace_id, name, external_reference, status,
         configuration_reference, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
            channel.id,
            channel.tenantId,
            channel.marketplaceId,
            channel.name,
            channel.externalReference,
            channel.status,
            channel.configurationReference,
            channel.createdAt,
            channel.updatedAt,
        ], { operation: 'channels.insert' });
    }
    async update(transaction, channel) {
        await transaction.query(`UPDATE channels
       SET name = $3,
           external_reference = $4,
           status = $5,
           configuration_reference = $6,
           updated_at = $7
       WHERE tenant_id = $1 AND id = $2`, [
            channel.tenantId,
            channel.id,
            channel.name,
            channel.externalReference,
            channel.status,
            channel.configurationReference,
            channel.updatedAt,
        ], { operation: 'channels.update' });
    }
}
