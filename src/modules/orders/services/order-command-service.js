/**
 * Facade for order write operations: create, channel ingest, acknowledge — with idempotency keys.
 */
const DEFAULT_CREATE_ROUTE_ID = 'orders.create';
const DEFAULT_CREATE_CHANNEL_ROUTE_ID = 'orders.create_channel';
const DEFAULT_CREATE_CHANNEL_FULFILLED_ROUTE_ID = 'orders.create_channel_fulfilled';
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

/**
 * @param {import('../public/order-command-service.js').CreateIntegrationFulfilledOrderCommand} command
 */
function toCreateIntegrationFulfilledOrderInput(command) {
    return {
        tenantId: command.tenantId,
        actorId: command.actorId,
        actorKind: command.actorKind,
        actorPermissions: command.actorPermissions,
        channelId: command.channelId,
        externalOrderReference: command.externalOrderReference,
        currency: command.currency,
        lines: command.lines.map((line) => ({
            stockLocationId: line.stockLocationId,
            quantity: line.quantity,
            ...(line.merchantSku === undefined ? {} : { merchantSku: line.merchantSku }),
            ...(line.channelProductNo === undefined ? {} : { channelProductNo: line.channelProductNo }),
            ...(line.productId === undefined ? {} : { productId: line.productId }),
            ...(line.offerId === undefined ? {} : { offerId: line.offerId ?? null }),
        })),
        ...(command.customer === undefined ? {} : { customer: command.customer }),
        ...(command.discountMinor === undefined ? {} : { discountMinor: command.discountMinor }),
        ...(command.taxMinor === undefined ? {} : { taxMinor: command.taxMinor }),
        ...(command.shippingMinor === undefined ? {} : { shippingMinor: command.shippingMinor }),
        ...(command.shipment === undefined ? {} : { shipment: command.shipment }),
    };
}

/**
 * @param {import('../public/order-command-service.js').CreateIntegrationOrderCommand} command
 */
function toCreateIntegrationOrderInput(command) {
    return {
        tenantId: command.tenantId,
        actorId: command.actorId,
        actorKind: command.actorKind,
        actorPermissions: command.actorPermissions,
        channelId: command.channelId,
        externalOrderReference: command.externalOrderReference,
        currency: command.currency,
        lines: command.lines.map((line) => ({
            stockLocationId: line.stockLocationId,
            quantity: line.quantity,
            ...(line.merchantSku === undefined ? {} : { merchantSku: line.merchantSku }),
            ...(line.channelProductNo === undefined ? {} : { channelProductNo: line.channelProductNo }),
            ...(line.productId === undefined ? {} : { productId: line.productId }),
            ...(line.offerId === undefined ? {} : { offerId: line.offerId ?? null }),
        })),
        ...(command.customer === undefined ? {} : { customer: command.customer }),
        ...(command.discountMinor === undefined ? {} : { discountMinor: command.discountMinor }),
        ...(command.taxMinor === undefined ? {} : { taxMinor: command.taxMinor }),
        ...(command.shippingMinor === undefined ? {} : { shippingMinor: command.shippingMinor }),
    };
}

/**
 * @param {object} deps
 * @param {{ execute: Function }} deps.createOrder
 * @param {{ execute: Function }} deps.createIntegrationOrder
 * @param {{ execute: Function }|null} deps.createIntegrationFulfilledOrder
 * @param {{ execute: Function }} deps.acknowledgeOrder
 * @param {import('../../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
 */
export function createOrderCommandService(deps) {
    /**
     * @param {import('../public/order-command-service.js').CreateOrderCommand} command
     * @returns {Promise<import('../public/order-command-service.js').CreateOrderResult>}
     */
    async function createOrder(command) {
        const createInput = toCreateOrderInput(command);

        if (command.transaction !== undefined) {
            const { order } = await deps.createOrder.execute({
                ...createInput,
                transaction: command.transaction,
            });
            return { order };
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
                const { order } = await deps.createOrder.execute({
                    ...createInput,
                    transaction: tx,
                });
                return { order };
            }, (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        const { order } = await deps.createOrder.execute(createInput);
        return { order };
    }

    /**
     * @param {import('../public/order-command-service.js').CreateIntegrationOrderCommand} command
     * @returns {Promise<import('../public/order-command-service.js').CreateIntegrationOrderResult>}
     */
    async function createIntegrationOrder(command) {
        const createInput = toCreateIntegrationOrderInput(command);

        if (command.transaction !== undefined) {
            const { order } = await deps.createIntegrationOrder.execute({
                ...createInput,
                transaction: command.transaction,
            });
            return { order };
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
                routeId: command.routeId ?? DEFAULT_CREATE_CHANNEL_ROUTE_ID,
                idempotencyKey: command.idempotencyKey,
            }, command.requestFingerprint, async (tx) => {
                const { order } = await deps.createIntegrationOrder.execute({
                    ...createInput,
                    transaction: tx,
                });
                return { order };
            }, (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        const { order } = await deps.createIntegrationOrder.execute(createInput);
        return { order };
    }

    /**
     * @param {import('../public/order-command-service.js').CreateIntegrationFulfilledOrderCommand} command
     * @returns {Promise<import('../public/order-command-service.js').CreateIntegrationFulfilledOrderResult>}
     */
    async function createIntegrationFulfilledOrder(command) {
        if (deps.createIntegrationFulfilledOrder === null) {
            throw new Error('CreateIntegrationFulfilledOrder is not wired');
        }
        const createInput = toCreateIntegrationFulfilledOrderInput(command);

        if (command.transaction !== undefined) {
            return deps.createIntegrationFulfilledOrder.execute({
                ...createInput,
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
                routeId: command.routeId ?? DEFAULT_CREATE_CHANNEL_FULFILLED_ROUTE_ID,
                idempotencyKey: command.idempotencyKey,
            }, command.requestFingerprint, async (tx) => deps.createIntegrationFulfilledOrder.execute({
                ...createInput,
                transaction: tx,
            }), (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        return deps.createIntegrationFulfilledOrder.execute(createInput);
    }

    /**
     * @param {import('../public/order-command-service.js').AcknowledgeOrderCommand} command
     * @returns {Promise<import('../public/order-command-service.js').AcknowledgeOrderResult>}
     */
    async function acknowledgeOrder(command) {
        const acknowledgeInput = {
            tenantId: command.tenantId,
            actorId: command.actorId,
            actorKind: command.actorKind,
            actorPermissions: command.actorPermissions,
            orderNumber: command.orderNumber,
        };

        if (command.transaction !== undefined) {
            const { order } = await deps.acknowledgeOrder.execute({
                ...acknowledgeInput,
                transaction: command.transaction,
            });
            return { order };
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
                routeId: command.routeId ?? DEFAULT_ACKNOWLEDGE_ROUTE_ID,
                idempotencyKey: command.idempotencyKey,
            }, command.requestFingerprint, async (tx) => {
                const { order } = await deps.acknowledgeOrder.execute({
                    ...acknowledgeInput,
                    transaction: tx,
                });
                return { order };
            }, (result) => ({ statusCode: 201, body: result }), { useTransaction: true });
            return outcome.value;
        }

        const { order } = await deps.acknowledgeOrder.execute(acknowledgeInput);
        return { order };
    }

    return {
        createOrder,
        createIntegrationOrder,
        createIntegrationFulfilledOrder,
        acknowledgeOrder,
    };
}
