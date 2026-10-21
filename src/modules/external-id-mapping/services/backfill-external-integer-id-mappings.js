import { ExternalIdMappingProvider } from '../models/external-id-mapping-namespace.js';
import {
    EXTERNAL_ID_BACKFILL_DEFAULT_BATCH_SIZE,
    EXTERNAL_ID_BACKFILL_RESOURCE_TYPES,
} from '../models/external-id-backfill.js';
import { clampBatchSize } from '../../../shared/pagination/index.js';

/**
 * @typedef {object} ExternalIdBackfillResourceTypeStats
 * @property {string} resourceType
 * @property {number} processed
 * @property {number} assigned
 * @property {number} batches
 */

/**
 * @typedef {object} ExternalIdBackfillTenantStats
 * @property {string} tenantId
 * @property {ExternalIdBackfillResourceTypeStats[]} resourceTypes
 */

/**
 * @typedef {object} ExternalIdBackfillRunResult
 * @property {boolean} success
 * @property {ExternalIdBackfillTenantStats[]} tenants
 */

export function createBackfillExternalIntegerIdMappings(deps) {
    /**
     * @param {string} tenantId
     * @param {string} resourceType
     * @param {number} batchSize
     */
    async function backfillResourceType(tenantId, resourceType, batchSize) {
        let afterResourceId = null;
        let processed = 0;
        let assigned = 0;
        let batches = 0;
        for (;;) {
            const resourceIds = await deps.database.execute(async (tx) => deps.backfillQueries.findUnmappedResourceIds(
                tx,
                tenantId,
                ExternalIdMappingProvider.COMPAT_V2,
                resourceType,
                afterResourceId,
                batchSize,
            ), { tenantId, readOnly: true });
            if (resourceIds.length === 0) {
                break;
            }
            batches += 1;
            const batchAssigned = await deps.database.execute(async (tx) => {
                let created = 0;
                for (const resourceId of resourceIds) {
                    await deps.externalIntegerIdMappingCommandService.assignMapping(tx, {
                        tenantId,
                        provider: ExternalIdMappingProvider.COMPAT_V2,
                        resourceType,
                        resourceId,
                    });
                    created += 1;
                }
                return created;
            }, { tenantId });
            processed += resourceIds.length;
            assigned += batchAssigned;
            afterResourceId = resourceIds.at(-1) ?? afterResourceId;
        }
        return { resourceType, processed, assigned, batches };
    }

    /**
     * @param {string} tenantId
     * @param {number} batchSize
     */
    async function backfillTenant(tenantId, batchSize) {
        /** @type {ExternalIdBackfillResourceTypeStats[]} */
        const resourceTypes = [];
        for (const resourceType of EXTERNAL_ID_BACKFILL_RESOURCE_TYPES) {
            const stats = await backfillResourceType(tenantId, resourceType, batchSize);
            resourceTypes.push(stats);
            deps.logger.info(
                {
                    tenantId,
                    resourceType,
                    processed: stats.processed,
                    assigned: stats.assigned,
                    batches: stats.batches,
                },
                'External ID backfill resource type finished',
            );
        }
        return { tenantId, resourceTypes };
    }

    return {
        /**
         * @param {object} [options]
         * @param {readonly string[]} [options.tenantIds]
         * @param {number} [options.batchSize]
         */
        async run(options = {}) {
            const batchSize = clampBatchSize(options.batchSize ?? EXTERNAL_ID_BACKFILL_DEFAULT_BATCH_SIZE);
            const tenantIds = options.tenantIds ?? await deps.backfillQueries.listActiveTenantIds(deps.database);
            /** @type {ExternalIdBackfillTenantStats[]} */
            const tenantStats = [];
            for (const tenantId of tenantIds) {
                const stats = await backfillTenant(tenantId, batchSize);
                tenantStats.push(stats);
            }
            return { success: true, tenants: tenantStats };
        },
    };
}
