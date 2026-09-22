/**
 * @typedef {object} ReturnQueryService
 * @property {(tenantId: string, returnId: string, tx?: object) => Promise<object>} getReturnById
 * Returns return detail with lines. Throws {@link NotFoundError} when missing.
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: string[],
 *   externalReferences?: string[],
 *   orderNumbers?: string[],
 *   externalOrderReferences?: string[],
 *   statuses?: string[],
 *   reasons?: string[],
 *   createdAfter?: Date,
 *   createdBefore?: Date,
 *   updatedAfter?: Date,
 *   updatedBefore?: Date,
 *   page?: number,
 *   pageSize?: number,
 *   sortDirection?: 'asc'|'desc',
 * }) => Promise<{ items: object[], totalCount: number, page: number, pageSize: number }>} listReturns
 * Tenant-scoped page-based return listing with optional filters.
 */
export { DefaultReturnQueryService } from '../application/return-query-service.js';
