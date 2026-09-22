/**
 * @typedef {object} ShipmentQueryService
 * @property {(tenantId: string, shipmentId: string, tx?: object) => Promise<object>} getShipmentById
 * Returns shipment detail with lines. Throws {@link NotFoundError} when missing.
 * @property {(tenantId: string, shipmentId: string, tx?: object) => Promise<object>} getShipmentSummaryById
 * Returns shipment header without lines.
 * @property {(tenantId: string, externalReference: string, tx?: object) => Promise<object>} findShipmentByExternalReference
 * Returns shipment detail by tenant-scoped external reference. Throws {@link NotFoundError} when missing.
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: string[],
 *   externalReferences?: string[],
 *   orderNumbers?: string[],
 *   externalOrderReferences?: string[],
 *   carrier?: string,
 *   shippedAfter?: Date,
 *   shippedBefore?: Date,
 *   createdAfter?: Date,
 *   createdBefore?: Date,
 *   updatedAfter?: Date,
 *   updatedBefore?: Date,
 *   deliveredAfter?: Date,
 *   deliveredBefore?: Date,
 *   page?: number,
 *   pageSize?: number,
 *   sortDirection?: 'asc'|'desc',
 * }) => Promise<{ items: object[], totalCount: number, page: number, pageSize: number }>} listShipments
 * Tenant-scoped page-based shipment listing with optional filters.
 */
export { DefaultShipmentQueryService } from '../application/shipment-query-service.js';
