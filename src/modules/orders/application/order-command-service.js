const DEFAULT_CREATE_ROUTE_ID = 'orders.create';
const DEFAULT_ACKNOWLEDGE_ROUTE_ID = 'orders.acknowledge';

/**
 * @param {import('../public/order-command-service.js').CreateOrderCommand} command
 */
function toCreateOrderInput(command) {
    return {
        tenantId: command.tenantId,
        actorId: command.actorId,
        actorKind: command.actorKind,
        actorPermissions: command.actorPermissions,
        channelId: command.channelId,
        currency: command.currency,
        lines: command.lines.map((line) => ({
            productId: line.productId,
            stockLocationId: line.stockLocationId,
            quantity: line.quantity,
            ...(line.offerId === undefined ? {} : { offerId: line.offerId ?? null }),
        })),
        ...(command.customer === undefined ? {} : { customer: command.customer }),
        ...(command.externalOrderReference === undefined
            ? {}
            : { externalOrderReference: command.externalOrderReference }),
        ...(command.discountMinor === undefined ? {} : { discountMinor: command.discountMinor }),
        ...(command.taxMinor === undefined ? {} : { taxMinor: command.taxMinor }),
        ...(command.shippingMinor === undefined ? {} : { shippingMinor: command.shippingMinor }),
    };
}

export class DefaultOrderCommandService {
    deps;

    /**
     * @param {object} deps
     * @param {import('./create-order.js').CreateOrder} deps.createOrder
     * @param {import('./acknowledge-order.js').AcknowledgeOrder} deps.acknowledgeOrder
     * @param {import('../../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {import('../public/order-command-service.js').CreateOrderCommand} command
     * @returns {Promise<import('../public/order-command-service.js').CreateOrderResult>}
     */
    async createOrder(command) {
        const createInput = toCreateOrderInput(command);

        if (command.transaction !== undefined) {
            const { order } = await this.deps.createOrder.execute({
                ...createInput,
                transaction: command.transaction,
            });
            return { order };
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
                const { order } = await this.deps.createOrder.execute({
                    ...createInput,
                    transaction: tx,
                });
                return { order };
            }, (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        const { order } = await this.deps.createOrder.execute(createInput);
        return { order };
    }

    /**
     * @param {import('../public/order-command-service.js').AcknowledgeOrderCommand} command
     * @returns {Promise<import('../public/order-command-service.js').AcknowledgeOrderResult>}
     */
    async acknowledgeOrder(command) {
        const acknowledgeInput = {
            tenantId: command.tenantId,
            actorId: command.actorId,
            actorKind: command.actorKind,
            actorPermissions: command.actorPermissions,
            orderNumber: command.orderNumber,
        };

        if (command.transaction !== undefined) {
            const { order } = await this.deps.acknowledgeOrder.execute({
                ...acknowledgeInput,
                transaction: command.transaction,
            });
            return { order };
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
            }, command.requestFingerprint, async (tx) => {
                const { order } = await this.deps.acknowledgeOrder.execute({
                    ...acknowledgeInput,
                    transaction: tx,
                });
                return { order };
            }, (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        const { order } = await this.deps.acknowledgeOrder.execute(acknowledgeInput);
        return { order };
    }
}
