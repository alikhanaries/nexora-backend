import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ConflictError, InternalError } from '../../../shared/errors/index.js';
import {
    assertExternalIdMappingProvider,
    assertExternalIdMappingResourceType,
} from '../domain/external-id-mapping-namespace.js';
import { parseOrThrow } from '../../../shared/validation/index.js';

const mappingRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    provider: z.string(),
    resource_type: z.string(),
    resource_id: z.string().uuid(),
    external_id: z.coerce.number(),
    created_at: z.date(),
});

const mappingSelect = `id, tenant_id, provider, resource_type, resource_id, external_id, created_at`;

/**
 * @param {z.infer<typeof mappingRowSchema>} row
 */
function toMapping(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        provider: row.provider,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        externalId: row.external_id,
        createdAt: row.created_at,
    };
}

export class PostgresExternalIntegerIdMappingRepository {
    /**
     * Atomically allocates the next external integer ID for the namespace and inserts the mapping.
     * Idempotent when a mapping already exists for the same resource.
     *
     * @param {object} transaction
     * @param {import('../domain/external-integer-id-mapping-repository.port.js').AssignExternalIntegerIdMappingInput} input
     */
    async assignMapping(transaction, input) {
        assertExternalIdMappingProvider(input.provider);
        assertExternalIdMappingResourceType(input.resourceType);

        const existing = await this.findExternalIdByResourceId(
            transaction,
            input.tenantId,
            input.provider,
            input.resourceType,
            input.resourceId,
        );
        if (existing !== null) {
            const row = await this.#findMappingRowByResourceId(
                transaction,
                input.tenantId,
                input.provider,
                input.resourceType,
                input.resourceId,
            );
            if (row === null) {
                throw new InternalError('External ID mapping lookup returned inconsistent state');
            }
            return toMapping(row);
        }

        const externalId = await this.#allocateExternalId(
            transaction,
            input.tenantId,
            input.provider,
            input.resourceType,
        );
        const mappingId = randomUUID();
        try {
            const result = await transaction.query(
                `INSERT INTO external_integer_id_mappings (
           id, tenant_id, provider, resource_type, resource_id, external_id
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${mappingSelect}`,
                [mappingId, input.tenantId, input.provider, input.resourceType, input.resourceId, externalId],
                { operation: 'external_integer_id_mappings.insert' },
            );
            const row = result.rows[0];
            if (row === undefined) {
                throw new InternalError('Failed to insert external integer ID mapping');
            }
            return toMapping(parseOrThrow(mappingRowSchema, row, 'external_integer_id_mappings row'));
        }
        catch (error) {
            if (error instanceof ConflictError) {
                const raced = await this.#findMappingRowByResourceId(
                    transaction,
                    input.tenantId,
                    input.provider,
                    input.resourceType,
                    input.resourceId,
                );
                if (raced !== null) {
                    return toMapping(raced);
                }
            }
            throw error;
        }
    }

    /**
     * @param {object} queryable
     */
    async findResourceIdByExternalId(queryable, tenantId, provider, resourceType, externalId) {
        assertExternalIdMappingProvider(provider);
        assertExternalIdMappingResourceType(resourceType);
        const result = await queryable.query(
            `SELECT resource_id
       FROM external_integer_id_mappings
       WHERE tenant_id = $1
         AND provider = $2
         AND resource_type = $3
         AND external_id = $4`,
            [tenantId, provider, resourceType, externalId],
            { operation: 'external_integer_id_mappings.find_resource_by_external_id' },
        );
        const row = result.rows[0];
        if (row === undefined) {
            return null;
        }
        return String(row.resource_id);
    }

    /**
     * @param {object} queryable
     */
    async findExternalIdByResourceId(queryable, tenantId, provider, resourceType, resourceId) {
        assertExternalIdMappingProvider(provider);
        assertExternalIdMappingResourceType(resourceType);
        const result = await queryable.query(
            `SELECT external_id
       FROM external_integer_id_mappings
       WHERE tenant_id = $1
         AND provider = $2
         AND resource_type = $3
         AND resource_id = $4`,
            [tenantId, provider, resourceType, resourceId],
            { operation: 'external_integer_id_mappings.find_external_id_by_resource_id' },
        );
        const row = result.rows[0];
        if (row === undefined) {
            return null;
        }
        return Number(row.external_id);
    }

    /**
     * @param {object} queryable
     * @param {readonly string[]} resourceIds
     */
    async findExternalIdsByResourceIds(queryable, tenantId, provider, resourceType, resourceIds) {
        assertExternalIdMappingProvider(provider);
        assertExternalIdMappingResourceType(resourceType);
        if (resourceIds.length === 0) {
            return new Map();
        }
        const uniqueIds = [...new Set(resourceIds)];
        const result = await queryable.query(
            `SELECT resource_id, external_id
       FROM external_integer_id_mappings
       WHERE tenant_id = $1
         AND provider = $2
         AND resource_type = $3
         AND resource_id = ANY($4::uuid[])`,
            [tenantId, provider, resourceType, uniqueIds],
            { operation: 'external_integer_id_mappings.find_external_ids_by_resource_ids' },
        );
        /** @type {Map<string, number>} */
        const mappings = new Map();
        for (const row of result.rows) {
            mappings.set(String(row.resource_id), Number(row.external_id));
        }
        return mappings;
    }

    /**
     * @param {object} transaction
     */
    async #allocateExternalId(transaction, tenantId, provider, resourceType) {
        const result = await transaction.query(
            `INSERT INTO external_integer_id_sequences (tenant_id, provider, resource_type, last_value)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tenant_id, provider, resource_type) DO UPDATE
         SET last_value = external_integer_id_sequences.last_value + 1,
             updated_at = now()
       RETURNING last_value`,
            [tenantId, provider, resourceType],
            { operation: 'external_integer_id_sequences.allocate' },
        );
        const row = result.rows[0];
        if (row === undefined) {
            throw new InternalError('Failed to allocate external integer ID');
        }
        const externalId = Number(row.last_value);
        if (!Number.isInteger(externalId) || externalId <= 0) {
            throw new InternalError('Allocated external integer ID is invalid');
        }
        return externalId;
    }

    /**
     * @param {object} queryable
     */
    async #findMappingRowByResourceId(queryable, tenantId, provider, resourceType, resourceId) {
        const result = await queryable.query(
            `SELECT ${mappingSelect}
       FROM external_integer_id_mappings
       WHERE tenant_id = $1
         AND provider = $2
         AND resource_type = $3
         AND resource_id = $4`,
            [tenantId, provider, resourceType, resourceId],
            { operation: 'external_integer_id_mappings.find_row_by_resource_id' },
        );
        const row = result.rows[0];
        if (row === undefined) {
            return null;
        }
        return parseOrThrow(mappingRowSchema, row, 'external_integer_id_mappings row');
    }
}
