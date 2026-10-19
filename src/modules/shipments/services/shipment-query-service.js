import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { toShipmentDetailDto, toShipmentDto, } from '../views/shipment-dto.js';
import { requireShipmentsRead } from './shipment-permissions.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function clampPageSize(pageSize) {
    const requested = pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(requested) || requested < 1) {
        throw new ValidationError('Page size must be a positive integer');
    }
    return Math.min(requested, MAX_PAGE_SIZE);
}

function clampPage(page) {
    const requested = page ?? 1;
    if (!Number.isInteger(requested) || requested < 1) {
        throw new ValidationError('Page must be a positive integer');
    }
    return requested;
}

/**
 * @param {object} deps
 * @param {import('../../authorization/public/index.js').AuthorizationService} deps.authorization
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresQueryable} deps.queryable
 * @param {import('../repositories/postgres-shipment-repository.js').PostgresShipmentRepository} deps.shipments
 */
export function createShipmentQueryService(deps) {
    async function getShipmentById(tenantId, shipmentId, tx) {
        const queryable = tx ?? deps.queryable;
        const shipment = await deps.shipments.findById(queryable, tenantId, shipmentId);
        if (shipment === null) {
            throw new NotFoundError('Shipment was not found', { tenantId, shipmentId });
        }
        const lines = await deps.shipments.listShipmentLines(queryable, tenantId, shipmentId);
        return toShipmentDetailDto(shipment, lines);
    }

    async function getShipmentSummaryById(tenantId, shipmentId, tx) {
        const queryable = tx ?? deps.queryable;
        const shipment = await deps.shipments.findById(queryable, tenantId, shipmentId);
        if (shipment === null) {
            throw new NotFoundError('Shipment was not found', { tenantId, shipmentId });
        }
        return toShipmentDto(shipment);
    }

    async function findShipmentByExternalReference(tenantId, externalReference, tx) {
        const queryable = tx ?? deps.queryable;
        const trimmed = externalReference.trim();
        const shipment = await deps.shipments.findByExternalReference(queryable, tenantId, trimmed);
        if (shipment === null) {
            throw new NotFoundError('Shipment was not found', {
                tenantId,
                externalReference: trimmed,
            });
        }
        const lines = await deps.shipments.listShipmentLines(queryable, tenantId, shipment.id);
        return toShipmentDetailDto(shipment, lines);
    }

    async function listShipments(input) {
        requireShipmentsRead(deps.authorization, input.actorPermissions);
        const page = clampPage(input.page);
        const pageSize = clampPageSize(input.pageSize);
        const filters = {
            ...(input.externalReferences === undefined ? {} : { externalReferences: input.externalReferences }),
            ...(input.orderNumbers === undefined ? {} : { orderNumbers: input.orderNumbers }),
            ...(input.externalOrderReferences === undefined
                ? {}
                : { externalOrderReferences: input.externalOrderReferences }),
            ...(input.carrier === undefined ? {} : { carrier: input.carrier }),
            ...(input.shippedAfter === undefined ? {} : { shippedAfter: input.shippedAfter }),
            ...(input.shippedBefore === undefined ? {} : { shippedBefore: input.shippedBefore }),
            ...(input.createdAfter === undefined ? {} : { createdAfter: input.createdAfter }),
            ...(input.createdBefore === undefined ? {} : { createdBefore: input.createdBefore }),
            ...(input.updatedAfter === undefined ? {} : { updatedAfter: input.updatedAfter }),
            ...(input.updatedBefore === undefined ? {} : { updatedBefore: input.updatedBefore }),
            ...(input.deliveredAfter === undefined ? {} : { deliveredAfter: input.deliveredAfter }),
            ...(input.deliveredBefore === undefined ? {} : { deliveredBefore: input.deliveredBefore }),
        };
        const sortDirection = input.sortDirection ?? 'asc';
        const totalCount = await deps.shipments.count(deps.queryable, input.tenantId, filters);
        const shipments = await deps.shipments.listPageOffset(deps.queryable, input.tenantId, filters, page, pageSize, sortDirection);
        const items = await Promise.all(shipments.map(async (shipment) => {
            const lines = await deps.shipments.listShipmentLines(deps.queryable, input.tenantId, shipment.id);
            return toShipmentDetailDto(shipment, lines);
        }));
        return {
            items,
            totalCount,
            page,
            pageSize,
        };
    }

    return {
        getShipmentById,
        getShipmentSummaryById,
        findShipmentByExternalReference,
        listShipments,
    };
}

/** @deprecated Prefer {@link createShipmentQueryService}; kept for existing import sites and JSDoc typedefs. */
export class DefaultShipmentQueryService {
    constructor(deps) {
        return createShipmentQueryService(deps);
    }
}
