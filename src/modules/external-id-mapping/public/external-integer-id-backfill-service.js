/**
 * Operational backfill for historical compat_v2 external integer ID mappings.
 *
 * @typedef {import('../application/backfill-external-integer-id-mappings.js').ExternalIdBackfillRunResult} ExternalIdBackfillRunResult
 *
 * @typedef {object} ExternalIntegerIdBackfillService
 * @property {(options?: { tenantIds?: readonly string[], batchSize?: number }) => Promise<ExternalIdBackfillRunResult>} run
 */

export { BackfillExternalIntegerIdMappings as DefaultExternalIntegerIdBackfillService } from '../application/backfill-external-integer-id-mappings.js';
