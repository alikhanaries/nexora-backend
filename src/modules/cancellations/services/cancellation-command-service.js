const DEFAULT_CREATE_ROUTE_ID = 'cancellations.create';

/**
 * @param {import('../public/cancellation-command-service.js').CreateCancellationCommand} command
 */
function toCreateCancellationInput(command) {
    return {
        tenantId: command.tenantId,
        actorId: command.actorId,
        actorKind: command.actorKind,
        actorPermissions: command.actorPermissions,
        orderId: command.orderId,
        permission: 'cancellations.create',
        lines: command.lines.map((line) => ({
            orderLineId: line.orderLineId,
            quantity: line.quantity,
        })),
        ...(command.reason === undefined ? {} : { reason: command.reason }),
        ...(command.externalReference === undefined ? {} : { externalReference: command.externalReference }),
    };
}

/**
 * @param {object} deps
 * @param {{ execute: Function }} deps.createCancellation
 * @param {import('../../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
 */
export function createCancellationCommandService(deps) {
    /**
     * @param {import('../public/cancellation-command-service.js').CreateCancellationCommand} command
     * @returns {Promise<import('../public/cancellation-command-service.js').CreateCancellationResult>}
     */
    async function createCancellation(command) {
        const createInput = toCreateCancellationInput(command);

        if (command.transaction !== undefined) {
            const { cancellation } = await deps.createCancellation.execute({
                ...createInput,
                transaction: command.transaction,
            });
            return { cancellation };
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
                const { cancellation } = await deps.createCancellation.execute({
                    ...createInput,
                    transaction: tx,
                });
                return { cancellation };
            }, (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        const { cancellation } = await deps.createCancellation.execute(createInput);
        return { cancellation };
    }

    return { createCancellation };
}

/** @deprecated Prefer {@link createCancellationCommandService}; kept for existing import sites and tests. */
export class DefaultCancellationCommandService {
    constructor(deps) {
        return createCancellationCommandService(deps);
    }
}
