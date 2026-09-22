const DEFAULT_CREATE_ROUTE_ID = 'returns.create';

/**
 * @param {import('../public/return-command-service.js').CreateReturnCommand} command
 */
function toCreateReturnInput(command) {
    return {
        tenantId: command.tenantId,
        actorId: command.actorId,
        actorKind: command.actorKind,
        actorPermissions: command.actorPermissions,
        orderId: command.orderId,
        lines: command.lines.map((line) => ({
            orderLineId: line.orderLineId,
            quantity: line.quantity,
            ...(line.reason === undefined ? {} : { reason: line.reason }),
        })),
        ...(command.reason === undefined ? {} : { reason: command.reason }),
        ...(command.shipmentId === undefined ? {} : { shipmentId: command.shipmentId }),
        ...(command.externalReference === undefined ? {} : { externalReference: command.externalReference }),
    };
}

export class DefaultReturnCommandService {
    deps;

    /**
     * @param {object} deps
     * @param {import('./create-return.js').CreateReturn} deps.createReturn
     * @param {import('../../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {import('../public/return-command-service.js').CreateReturnCommand} command
     * @returns {Promise<import('../public/return-command-service.js').CreateReturnResult>}
     */
    async createReturn(command) {
        const createInput = toCreateReturnInput(command);

        if (command.transaction !== undefined) {
            const { return: returnDetail } = await this.deps.createReturn.execute({
                ...createInput,
                transaction: command.transaction,
            });
            return { return: returnDetail };
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
                const { return: returnDetail } = await this.deps.createReturn.execute({
                    ...createInput,
                    transaction: tx,
                });
                return { return: returnDetail };
            }, (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        const { return: returnDetail } = await this.deps.createReturn.execute(createInput);
        return { return: returnDetail };
    }
}
