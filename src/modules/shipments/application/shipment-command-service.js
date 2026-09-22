const DEFAULT_CREATE_ROUTE_ID = 'shipments.create';

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

export class DefaultShipmentCommandService {
    deps;

    /**
     * @param {object} deps
     * @param {import('./create-shipment.js').CreateShipment} deps.createShipment
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
}
