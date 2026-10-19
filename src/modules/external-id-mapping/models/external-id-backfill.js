import { ExternalIdMappingResourceType } from './external-id-mapping-namespace.js';

/** Default page size for historical external ID backfill batches. */
export const EXTERNAL_ID_BACKFILL_DEFAULT_BATCH_SIZE = 100;

/**
 * Resource types processed in dependency-friendly order (orders before order lines).
 * @type {readonly string[]}
 */
export const EXTERNAL_ID_BACKFILL_RESOURCE_TYPES = Object.freeze([
    ExternalIdMappingResourceType.ORDER,
    ExternalIdMappingResourceType.ORDER_LINE,
    ExternalIdMappingResourceType.SHIPMENT,
    ExternalIdMappingResourceType.CANCELLATION,
    ExternalIdMappingResourceType.RETURN,
]);

/**
 * Whitelisted commerce tables for backfill discovery queries.
 * @type {Readonly<Record<string, { table: string }>>}
 */
export const EXTERNAL_ID_BACKFILL_RESOURCE_TABLES = Object.freeze({
    [ExternalIdMappingResourceType.ORDER]: { table: 'orders' },
    [ExternalIdMappingResourceType.ORDER_LINE]: { table: 'order_lines' },
    [ExternalIdMappingResourceType.SHIPMENT]: { table: 'shipments' },
    [ExternalIdMappingResourceType.CANCELLATION]: { table: 'cancellations' },
    [ExternalIdMappingResourceType.RETURN]: { table: 'returns' },
});

/**
 * @param {string} resourceType
 */
export function resolveExternalIdBackfillTable(resourceType) {
    const entry = EXTERNAL_ID_BACKFILL_RESOURCE_TABLES[resourceType];
    if (entry === undefined) {
        throw new Error(`Unsupported external ID backfill resource type: ${resourceType}`);
    }
    return entry.table;
}
