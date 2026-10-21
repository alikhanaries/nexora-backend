/**
 * Operational backfill for historical compat_v2 external integer ID mappings.
 *
 * @typedef {import('../services/backfill-external-integer-id-mappings.js').ExternalIdBackfillRunResult} ExternalIdBackfillRunResult
 *
 * @typedef {object} ExternalIntegerIdBackfillService
 * @property {(options?: { tenantIds?: readonly string[], batchSize?: number }) => Promise<ExternalIdBackfillRunResult>} run
 */

export { createBackfillExternalIntegerIdMappings as createExternalIntegerIdBackfillService } from '../services/backfill-external-integer-id-mappings.js';
