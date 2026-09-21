/**
 * @typedef {object} ReturnQueryService
 * @property {(tenantId: string, returnId: string, tx?: object) => Promise<object>} getReturnById
 * Returns return detail with lines. Throws {@link NotFoundError} when missing.
 */
export { DefaultReturnQueryService } from '../application/return-query-service.js';
