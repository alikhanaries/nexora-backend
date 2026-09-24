import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { isMarketplaceNexoraEntityType } from '../domain/marketplace-nexora-entity-type.js';

const rowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    channel_id: z.string().uuid(),
    marketplace_key: z.string(),
    nexora_entity_type: z.string(),
    nexora_entity_id: z.string().uuid(),
    external_entity_type: z.string(),
    external_entity_id: z.string(),
    created_at: z.date(),
    updated_at: z.date(),
});

export class PostgresMarketplaceEntityMappingRepository {
    /**
     * @param {object} queryable
     * @param {string} tenantId
     * @param {string} channelId
     * @param {string} marketplaceKey
     * @param {string} nexoraEntityType
     * @param {string} nexoraEntityId
     */
    async findByNexoraEntity(queryable, tenantId, channelId, marketplaceKey, nexoraEntityType, nexoraEntityId) {
        const result = await queryable.query(`SELECT id, tenant_id, channel_id, marketplace_key, nexora_entity_type,
              nexora_entity_id, external_entity_type, external_entity_id, created_at, updated_at
       FROM marketplace_entity_mappings
       WHERE tenant_id = $1 AND channel_id = $2 AND marketplace_key = $3
         AND nexora_entity_type = $4 AND nexora_entity_id = $5`, [
            tenantId,
            channelId,
            marketplaceKey,
            nexoraEntityType,
            nexoraEntityId,
        ], { operation: 'marketplace_entity_mappings.find_by_nexora_entity' });
        const row = result.rows[0];
        if (row === undefined) {
            return null;
        }
        return parseOrThrow(rowSchema, row, 'marketplace_entity_mappings row');
    }

    /**
     * @param {object} queryable
     * @param {string} tenantId
     * @param {string} channelId
     * @param {string} marketplaceKey
     * @param {string} externalEntityType
     * @param {string} externalEntityId
     */
    async findByExternalEntity(queryable, tenantId, channelId, marketplaceKey, externalEntityType, externalEntityId) {
        const result = await queryable.query(`SELECT id, tenant_id, channel_id, marketplace_key, nexora_entity_type,
              nexora_entity_id, external_entity_type, external_entity_id, created_at, updated_at
       FROM marketplace_entity_mappings
       WHERE tenant_id = $1 AND channel_id = $2 AND marketplace_key = $3
         AND external_entity_type = $4 AND external_entity_id = $5`, [
            tenantId,
            channelId,
            marketplaceKey,
            externalEntityType,
            externalEntityId,
        ], { operation: 'marketplace_entity_mappings.find_by_external_entity' });
        const row = result.rows[0];
        if (row === undefined) {
            return null;
        }
        return parseOrThrow(rowSchema, row, 'marketplace_entity_mappings row');
    }

    /**
     * @param {object} transaction
     * @param {object} input
     */
    async upsert(transaction, input) {
        if (!isMarketplaceNexoraEntityType(input.nexoraEntityType)) {
            throw new Error('Invalid nexora entity type for marketplace mapping');
        }
        const id = input.id ?? randomUUID();
        await transaction.query(`INSERT INTO marketplace_entity_mappings (
         id, tenant_id, channel_id, marketplace_key, nexora_entity_type, nexora_entity_id,
         external_entity_type, external_entity_id, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
       ON CONFLICT (tenant_id, channel_id, marketplace_key, nexora_entity_type, nexora_entity_id)
       DO UPDATE SET
         external_entity_type = EXCLUDED.external_entity_type,
         external_entity_id = EXCLUDED.external_entity_id,
         updated_at = now()`, [
            id,
            input.tenantId,
            input.channelId,
            input.marketplaceKey,
            input.nexoraEntityType,
            input.nexoraEntityId,
            input.externalEntityType,
            input.externalEntityId,
        ], { operation: 'marketplace_entity_mappings.upsert' });
    }

    /**
     * @param {object} transaction
     * @param {string} tenantId
     * @param {string} mappingId
     */
    async deleteById(transaction, tenantId, mappingId) {
        await transaction.query(`DELETE FROM marketplace_entity_mappings
       WHERE tenant_id = $1 AND id = $2`, [tenantId, mappingId], {
            operation: 'marketplace_entity_mappings.delete_by_id',
        });
    }
}
