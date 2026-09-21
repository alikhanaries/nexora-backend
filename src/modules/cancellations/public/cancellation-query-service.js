/**
 * @typedef {object} CancellationQueryService
 * @property {(tenantId: string, cancellationId: string, tx?: object) => Promise<object>} getCancellationById
 * Returns cancellation detail with lines. Throws {@link NotFoundError} when missing.
 */
export { DefaultCancellationQueryService } from '../application/cancellation-query-service.js';
