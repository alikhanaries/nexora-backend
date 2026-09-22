const DEFAULT_CREATE_ROUTE_ID = 'returns.create';
const DEFAULT_ACKNOWLEDGE_ROUTE_ID = 'returns.acknowledge';
const DEFAULT_RECEIVE_ROUTE_ID = 'returns.process_receive';

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

/**
 * @param {import('../public/return-command-service.js').AcknowledgeReturnCommand} command
 */
function toAcknowledgeReturnInput(command) {
    return {
        tenantId: command.tenantId,
        actorId: command.actorId,
        actorKind: command.actorKind,
        actorPermissions: command.actorPermissions,
        returnId: command.returnId,
    };
}

/**
 * @param {import('../public/return-command-service.js').ProcessReturnReceiveCommand} command
 */
function toProcessReturnReceiveInput(command) {
    return {
        tenantId: command.tenantId,
        actorId: command.actorId,
        actorKind: command.actorKind,
        actorPermissions: command.actorPermissions,
        returnId: command.returnId,
        lineDecisions: command.lineDecisions.map((line) => ({
            merchantProductNo: line.merchantProductNo,
            acceptedQuantity: line.acceptedQuantity,
            rejectedQuantity: line.rejectedQuantity,
        })),
    };
}

export class DefaultReturnCommandService {
    deps;

    /**
     * @param {object} deps
     * @param {import('./create-return.js').CreateReturn} deps.createReturn
     * @param {import('./acknowledge-return.js').AcknowledgeReturn} deps.acknowledgeReturn
     * @param {import('./process-return-receive.js').ProcessReturnReceive} deps.processReturnReceive
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

    /**
     * @param {import('../public/return-command-service.js').AcknowledgeReturnCommand} command
     * @returns {Promise<import('../public/return-command-service.js').AcknowledgeReturnResult>}
     */
    async acknowledgeReturn(command) {
        const acknowledgeInput = toAcknowledgeReturnInput(command);

        if (command.transaction !== undefined) {
            return this.deps.acknowledgeReturn.execute({
                ...acknowledgeInput,
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
                routeId: command.routeId ?? DEFAULT_ACKNOWLEDGE_ROUTE_ID,
                idempotencyKey: command.idempotencyKey,
            }, command.requestFingerprint, async (tx) => this.deps.acknowledgeReturn.execute({
                ...acknowledgeInput,
                transaction: tx,
            }), (result) => ({ statusCode: 200, body: result }), { useTransaction: true });
            return outcome.value;
        }

        return this.deps.acknowledgeReturn.execute(acknowledgeInput);
    }

    /**
     * @param {import('../public/return-command-service.js').ProcessReturnReceiveCommand} command
     * @returns {Promise<import('../public/return-command-service.js').ProcessReturnReceiveResult>}
     */
    async processReturnReceive(command) {
        const receiveInput = toProcessReturnReceiveInput(command);

        if (command.transaction !== undefined) {
            return this.deps.processReturnReceive.execute({
                ...receiveInput,
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
                routeId: command.routeId ?? DEFAULT_RECEIVE_ROUTE_ID,
                idempotencyKey: command.idempotencyKey,
            }, command.requestFingerprint, async (tx) => this.deps.processReturnReceive.execute({
                ...receiveInput,
                transaction: tx,
            }), (result) => ({ statusCode: 200, body: result }), { useTransaction: true });
            return outcome.value;
        }

        return this.deps.processReturnReceive.execute(receiveInput);
    }
}
