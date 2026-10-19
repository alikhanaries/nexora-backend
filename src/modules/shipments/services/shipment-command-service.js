const DEFAULT_CREATE_ROUTE_ID = 'shipments.create';
const DEFAULT_UPDATE_TRACKING_ROUTE_ID = 'shipments.update_tracking';

/**
 * @param {import('../public/shipment-command-service.js').CreateShipmentCommand} command
 */
function toCreateShipmentInput(command) {
    return {
        tenantId: command.tenantId,
        actorId: command.actorId,
        actorKind: command.actorKind,
        actorPermissions: command.actorPermissions,
        orderId: command.orderId,
        lines: command.lines.map((line) => ({
            orderLineId: line.orderLineId,
            quantity: line.quantity,
        })),
        ...(command.carrier === undefined ? {} : { carrier: command.carrier }),
        ...(command.service === undefined ? {} : { service: command.service }),
        ...(command.trackingNumber === undefined ? {} : { trackingNumber: command.trackingNumber }),
        ...(command.externalReference === undefined ? {} : { externalReference: command.externalReference }),
        ...(command.skipAuthorization === undefined ? {} : { skipAuthorization: command.skipAuthorization }),
    };
}

/**
 * @param {import('../public/shipment-command-service.js').UpdateShipmentTrackingCommand} command
 */
function toUpdateShipmentTrackingInput(command) {
    return {
        tenantId: command.tenantId,
        actorId: command.actorId,
        actorKind: command.actorKind,
        actorPermissions: command.actorPermissions,
        externalReference: command.externalReference,
        carrier: command.carrier,
        trackingNumber: command.trackingNumber,
    };
}

/**
 * @param {object} deps
 * @param {{ execute: Function }} deps.createShipment
 * @param {{ execute: Function }} deps.updateShipmentTracking
 * @param {import('../../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
 */
export function createShipmentCommandService(deps) {
    /**
     * @param {import('../public/shipment-command-service.js').CreateShipmentCommand} command
     * @returns {Promise<import('../public/shipment-command-service.js').CreateShipmentResult>}
     */
    async function createShipment(command) {
        const createInput = toCreateShipmentInput(command);

        if (command.transaction !== undefined) {
            const { shipment } = await deps.createShipment.execute({
                ...createInput,
                transaction: command.transaction,
            });
            return { shipment };
        }

        if (command.idempotencyKey !== undefined) {
            if (deps.idempotency === undefined) {
                throw new Error('Idempotency service is required when idempotencyKey is provided');
            }
            if (command.principalFingerprint === undefined || command.requestFingerprint === undefined) {
                throw new Error('principalFingerprint and requestFingerprint are required when idempotencyKey is provided');
            }
            const outcome = await deps.idempotency.execute({
                tenantId: command.tenantId,
                principalFingerprint: command.principalFingerprint,
                routeId: command.routeId ?? DEFAULT_CREATE_ROUTE_ID,
                idempotencyKey: command.idempotencyKey,
            }, command.requestFingerprint, async (tx) => {
                const { shipment } = await deps.createShipment.execute({
                    ...createInput,
                    transaction: tx,
                });
                return { shipment };
            }, (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        const { shipment } = await deps.createShipment.execute(createInput);
        return { shipment };
    }

    /**
     * @param {import('../public/shipment-command-service.js').UpdateShipmentTrackingCommand} command
     * @returns {Promise<import('../public/shipment-command-service.js').UpdateShipmentTrackingResult>}
     */
    async function updateShipmentTracking(command) {
        const updateInput = toUpdateShipmentTrackingInput(command);

        if (command.transaction !== undefined) {
            return deps.updateShipmentTracking.execute({
                ...updateInput,
                transaction: command.transaction,
            });
        }

        if (command.idempotencyKey !== undefined) {
            if (deps.idempotency === undefined) {
                throw new Error('Idempotency service is required when idempotencyKey is provided');
            }
            if (command.principalFingerprint === undefined || command.requestFingerprint === undefined) {
                throw new Error('principalFingerprint and requestFingerprint are required when idempotencyKey is provided');
            }
            const outcome = await deps.idempotency.execute({
                tenantId: command.tenantId,
                principalFingerprint: command.principalFingerprint,
                routeId: command.routeId ?? DEFAULT_UPDATE_TRACKING_ROUTE_ID,
                idempotencyKey: command.idempotencyKey,
            }, command.requestFingerprint, async (tx) => deps.updateShipmentTracking.execute({
                ...updateInput,
                transaction: tx,
            }), (result) => ({ statusCode: 200, body: result }), { useTransaction: true });
            return outcome.value;
        }

        return deps.updateShipmentTracking.execute(updateInput);
    }

    return { createShipment, updateShipmentTracking };
}

/** @deprecated Prefer {@link createShipmentCommandService}; kept for existing import sites and tests. */
export class DefaultShipmentCommandService {
    constructor(deps) {
        return createShipmentCommandService(deps);
    }
}
