/**
 * @typedef {object} CancellationQueryService
 * @property {(tenantId: string, cancellationId: string, tx?: object) => Promise<object>} getCancellationById
 * Returns cancellation detail with lines. Throws {@link NotFoundError} when missing.
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: string[],
 *   externalReferences?: string[],
 *   orderNumbers?: string[],
 *   externalOrderReferences?: string[],
 *   createdAfter?: Date,
 *   createdBefore?: Date,
 *   updatedAfter?: Date,
 *   updatedBefore?: Date,
 *   page?: number,
 *   pageSize?: number,
 *   sortDirection?: 'asc'|'desc',
 * }) => Promise<{ items: object[], totalCount: number, page: number, pageSize: number }>} listCancellations
 * Tenant-scoped page-based cancellation listing with optional filters.
 */
export { DefaultCancellationQueryService } from '../application/cancellation-query-service.js';
