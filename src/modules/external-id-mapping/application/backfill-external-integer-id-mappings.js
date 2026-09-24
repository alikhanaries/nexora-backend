import { ExternalIdMappingProvider } from '../domain/external-id-mapping-namespace.js';
import {
    EXTERNAL_ID_BACKFILL_DEFAULT_BATCH_SIZE,
    EXTERNAL_ID_BACKFILL_RESOURCE_TYPES,
} from '../domain/external-id-backfill.js';
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

export class BackfillExternalIntegerIdMappings {
    deps;

    /**
     * @param {object} deps
     * @param {{ execute: Function, query: Function }} deps.database
     * @param {import('../public/external-integer-id-mapping-command-service.js').ExternalIntegerIdMappingCommandService} deps.externalIntegerIdMappingCommandService
     * @param {import('../infrastructure/postgres-external-id-backfill-queries.js').PostgresExternalIdBackfillQueries} deps.backfillQueries
     * @param {import('pino').Logger} deps.logger
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} [options]
     * @param {readonly string[]} [options.tenantIds]
     * @param {number} [options.batchSize]
     */
    async run(options = {}) {
        const batchSize = clampBatchSize(options.batchSize ?? EXTERNAL_ID_BACKFILL_DEFAULT_BATCH_SIZE);
        const tenantIds = options.tenantIds ?? await this.deps.backfillQueries.listActiveTenantIds(this.deps.database);
        /** @type {ExternalIdBackfillTenantStats[]} */
        const tenantStats = [];
        for (const tenantId of tenantIds) {
            const stats = await this.#backfillTenant(tenantId, batchSize);
            tenantStats.push(stats);
        }
        return { success: true, tenants: tenantStats };
    }

    /**
     * @param {string} tenantId
     * @param {number} batchSize
     */
    async #backfillTenant(tenantId, batchSize) {
        /** @type {ExternalIdBackfillResourceTypeStats[]} */
        const resourceTypes = [];
        for (const resourceType of EXTERNAL_ID_BACKFILL_RESOURCE_TYPES) {
            const stats = await this.#backfillResourceType(tenantId, resourceType, batchSize);
            resourceTypes.push(stats);
            this.deps.logger.info(
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

    /**
     * @param {string} tenantId
     * @param {string} resourceType
     * @param {number} batchSize
     */
    async #backfillResourceType(tenantId, resourceType, batchSize) {
        let afterResourceId = null;
        let processed = 0;
        let assigned = 0;
        let batches = 0;
        for (;;) {
            const resourceIds = await this.deps.database.execute(async (tx) => this.deps.backfillQueries.findUnmappedResourceIds(
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
            const batchAssigned = await this.deps.database.execute(async (tx) => {
                let created = 0;
                for (const resourceId of resourceIds) {
                    await this.deps.externalIntegerIdMappingCommandService.assignMapping(tx, {
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
}
