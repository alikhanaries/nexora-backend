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

export class DefaultShipmentCommandService {
    deps;

    /**
     * @param {object} deps
     * @param {import('./create-shipment.js').CreateShipment} deps.createShipment
     * @param {import('./update-shipment-tracking.js').UpdateShipmentTracking} deps.updateShipmentTracking
     * @param {import('../../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {import('../public/shipment-command-service.js').CreateShipmentCommand} command
     * @returns {Promise<import('../public/shipment-command-service.js').CreateShipmentResult>}
     */
    async createShipment(command) {
        const createInput = toCreateShipmentInput(command);

        if (command.transaction !== undefined) {
            const { shipment } = await this.deps.createShipment.execute({
                ...createInput,
                transaction: command.transaction,
            });
            return { shipment };
        }

        if (command.idempotencyKey !== undefined) {
            if (this.deps.idempotency === undefined) {
                throw new Error('Idempotency service is required when idempotencyKey is provided');
            }
            if (command.principalFingerprint === undefined || command.requestFingerprint === undefined) {
                throw new Error('principalFingerprint and requestFingerprint are required when idempotencyKey is provided');
            }
            const outcome = await this.deps.idempotency.execute({
                tenantId: command.tenantId,
                principalFingerprint: command.principalFingerprint,
                routeId: command.routeId ?? DEFAULT_CREATE_ROUTE_ID,
                idempotencyKey: command.idempotencyKey,
            }, command.requestFingerprint, async (tx) => {
                const { shipment } = await this.deps.createShipment.execute({
                    ...createInput,
                    transaction: tx,
                });
                return { shipment };
            }, (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        const { shipment } = await this.deps.createShipment.execute(createInput);
        return { shipment };
    }

    /**
     * @param {import('../public/shipment-command-service.js').UpdateShipmentTrackingCommand} command
     * @returns {Promise<import('../public/shipment-command-service.js').UpdateShipmentTrackingResult>}
     */
    async updateShipmentTracking(command) {
        const updateInput = toUpdateShipmentTrackingInput(command);

        if (command.transaction !== undefined) {
            return this.deps.updateShipmentTracking.execute({
                ...updateInput,
                transaction: command.transaction,
            });
        }

        if (command.idempotencyKey !== undefined) {
            if (this.deps.idempotency === undefined) {
                throw new Error('Idempotency service is required when idempotencyKey is provided');
            }
            if (command.principalFingerprint === undefined || command.requestFingerprint === undefined) {
                throw new Error('principalFingerprint and requestFingerprint are required when idempotencyKey is provided');
            }
            const outcome = await this.deps.idempotency.execute({
                tenantId: command.tenantId,
                principalFingerprint: command.principalFingerprint,
                routeId: command.routeId ?? DEFAULT_UPDATE_TRACKING_ROUTE_ID,
                idempotencyKey: command.idempotencyKey,
            }, command.requestFingerprint, async (tx) => this.deps.updateShipmentTracking.execute({
                ...updateInput,
                transaction: tx,
            }), (result) => ({ statusCode: 200, body: result }), { useTransaction: true });
            return outcome.value;
        }

        return this.deps.updateShipmentTracking.execute(updateInput);
    }
}
