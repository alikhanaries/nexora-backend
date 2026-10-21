import { BusinessRuleError, NotFoundError, ValidationError } from '../../../../shared/errors/index.js';
import { MarketplaceOrderLifecycleOperation } from '../models/marketplace-order-lifecycle-operation.js';
import { MarketplaceOrderLifecycleOutcome } from '../models/marketplace-order-lifecycle-outcome.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../models/normalized-marketplace-lifecycle-target-status.js';
import { MarketplaceOrderLifecyclePermanentError } from './marketplace-order-lifecycle-errors.js';
import { resolveMarketplaceLifecycleOrderLines } from './resolve-marketplace-lifecycle-order-lines.js';

const SYSTEM_ACTOR_ID = 'marketplace-order-lifecycle';
const LIFECYCLE_PERMISSIONS = Object.freeze([
    'orders.update',
    'orders.cancel',
    'cancellations.create',
    'returns.create',
    'shipments.create',
    'shipments.ship',
]);

/**
 * Applies a normalized lifecycle command to Wasl order services (no provider HTTP).
 */
/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createExecuteMarketplaceOrderLifecycleOperation(deps) {
    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {import('./normalized-marketplace-lifecycle-command.schema.js').normalizedMarketplaceLifecycleCommandSchema['_output']} command
     * @param {import('../../models/order.js').Order} order
     * @param {object} tx
     */
    async function execute(input, command, order, tx) {
        switch (command.operation) {
            case MarketplaceOrderLifecycleOperation.STATUS_SYNC:
                return applyStatusSync(input, command, order, tx);
            case MarketplaceOrderLifecycleOperation.CANCEL_ORDER:
                return applyCancelOrder(input, command, order, tx);
            case MarketplaceOrderLifecycleOperation.UPDATE_ORDER:
                return { outcome: MarketplaceOrderLifecycleOutcome.NOOP, orderId: order.id };
            case MarketplaceOrderLifecycleOperation.RETURN_ORDER:
                return applyReturnOrder(input, command, order, tx);
            case MarketplaceOrderLifecycleOperation.REFUND_ORDER:
            case MarketplaceOrderLifecycleOperation.FULFILL_ORDER:
            case MarketplaceOrderLifecycleOperation.SHIPMENT_UPDATE:
                throw new MarketplaceOrderLifecyclePermanentError('Lifecycle executor is not implemented for this operation', {
                    operation: command.operation,
                });
            default:
                throw new MarketplaceOrderLifecyclePermanentError('Unknown lifecycle operation', {
                    operation: command.operation,
                });
        }
    }

    /**
     * @param {object} input
     * @param {object} command
     * @param {import('../../models/order.js').Order} order
     * @param {object} tx
     */
    async function applyStatusSync(input, command, order, tx) {
        if (command.targetStatus === NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN) {
            return { outcome: MarketplaceOrderLifecycleOutcome.NOOP, orderId: order.id };
        }
        if (command.targetStatus === NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED) {
            if (order.status === 'CONFIRMED') {
                return { outcome: MarketplaceOrderLifecycleOutcome.DUPLICATE, orderId: order.id };
            }
            await deps.confirmOrder.execute({
                tenantId: input.tenantId,
                actorId: SYSTEM_ACTOR_ID,
                actorKind: 'api-key',
                actorPermissions: LIFECYCLE_PERMISSIONS,
                orderId: order.id,
                transaction: tx,
            });
            return { outcome: MarketplaceOrderLifecycleOutcome.APPLIED, orderId: order.id };
        }
        if (command.targetStatus === NormalizedMarketplaceLifecycleTargetStatus.CANCELLED) {
            return applyCancelOrder(input, {
                ...command,
                operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
                lines: undefined,
            }, order, tx);
        }
        if (command.targetStatus === NormalizedMarketplaceLifecycleTargetStatus.FULFILLED) {
            return applyFulfilledStatusSync(input, command, order, tx);
        }
        if (command.targetStatus === NormalizedMarketplaceLifecycleTargetStatus.RETURNED) {
            return applyReturnOrder(input, {
                ...command,
                operation: MarketplaceOrderLifecycleOperation.RETURN_ORDER,
                lines: command.lines ?? [],
            }, order, tx);
        }
        throw new MarketplaceOrderLifecyclePermanentError('Target status is not supported for synchronization', {
            targetStatus: command.targetStatus,
        });
    }

    /**
     * @param {object} input
     * @param {object} command
     * @param {import('../../models/order.js').Order} order
     * @param {object} tx
     */
    async function applyFulfilledStatusSync(input, command, order, tx) {
        if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
            return { outcome: MarketplaceOrderLifecycleOutcome.DUPLICATE, orderId: order.id };
        }
        if (deps.shipmentCommandService === undefined || deps.shipShipment === undefined) {
            throw new MarketplaceOrderLifecyclePermanentError('Shipment services are not configured for fulfillment sync');
        }
        const lines = await resolveMarketplaceLifecycleOrderLines({
            orders: deps.orders,
            productQueryService: deps.productQueryService,
        }, {
            tenantId: input.tenantId,
            orderId: order.id,
            lines: undefined,
        }, tx);
        const shipmentLines = lines
            .map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity }))
            .filter((line) => line.quantity > 0);
        if (shipmentLines.length === 0) {
            return { outcome: MarketplaceOrderLifecycleOutcome.NOOP, orderId: order.id };
        }
        const { shipment } = await deps.shipmentCommandService.createShipment({
            tenantId: input.tenantId,
            actorId: SYSTEM_ACTOR_ID,
            actorKind: 'api-key',
            actorPermissions: LIFECYCLE_PERMISSIONS,
            orderId: order.id,
            lines: shipmentLines,
            externalReference: command.externalEventId,
            skipAuthorization: true,
            transaction: tx,
        });
        await deps.shipShipment.execute({
            tenantId: input.tenantId,
            actorId: SYSTEM_ACTOR_ID,
            actorKind: 'api-key',
            actorPermissions: LIFECYCLE_PERMISSIONS,
            shipmentId: shipment.id,
            skipAuthorization: true,
            transaction: tx,
        });
        return { outcome: MarketplaceOrderLifecycleOutcome.APPLIED, orderId: order.id, shipmentId: shipment.id };
    }

    /**
     * @param {object} input
     * @param {object} command
     * @param {import('../../models/order.js').Order} order
     * @param {object} tx
     */
    async function applyReturnOrder(input, command, order, tx) {
        if (deps.returnCommandService === undefined) {
            throw new MarketplaceOrderLifecyclePermanentError('Return command service is not configured');
        }
        const lines = await resolveMarketplaceLifecycleOrderLines({
            orders: deps.orders,
            productQueryService: deps.productQueryService,
        }, {
            tenantId: input.tenantId,
            orderId: order.id,
            lines: command.lines,
        }, tx);
        const returnLines = lines
            .map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity }))
            .filter((line) => line.quantity > 0);
        if (returnLines.length === 0) {
            throw new BusinessRuleError('Return must include at least one line');
        }
        const { return: createdReturn } = await deps.returnCommandService.createReturn({
            tenantId: input.tenantId,
            actorId: SYSTEM_ACTOR_ID,
            actorKind: 'api-key',
            actorPermissions: LIFECYCLE_PERMISSIONS,
            orderId: order.id,
            lines: returnLines,
            reason: command.reason ?? null,
            externalReference: command.externalEventId,
            transaction: tx,
        });
        return { outcome: MarketplaceOrderLifecycleOutcome.APPLIED, orderId: order.id, returnId: createdReturn.id };
    }

    /**
     * @param {object} input
     * @param {object} command
     * @param {import('../../models/order.js').Order} order
     * @param {object} tx
     */
    async function applyCancelOrder(input, command, order, tx) {
        if (order.status === 'CANCELLED') {
            return { outcome: MarketplaceOrderLifecycleOutcome.DUPLICATE, orderId: order.id };
        }
        const lines = await resolveMarketplaceLifecycleOrderLines({
            orders: deps.orders,
            productQueryService: deps.productQueryService,
        }, {
            tenantId: input.tenantId,
            orderId: order.id,
            lines: command.lines,
        }, tx);
        const cancelLines = lines
            .map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity }))
            .filter((line) => line.quantity > 0);
        if (cancelLines.length === 0) {
            throw new BusinessRuleError('No cancellable quantity remains on this order');
        }
        try {
            await deps.cancellationCommandService.createCancellation({
                tenantId: input.tenantId,
                actorId: SYSTEM_ACTOR_ID,
                actorKind: 'api-key',
                actorPermissions: LIFECYCLE_PERMISSIONS,
                orderId: order.id,
                lines: cancelLines,
                reason: command.reason ?? null,
                externalReference: command.externalEventId,
                transaction: tx,
            });
        }
        catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            if (error instanceof ValidationError || error instanceof BusinessRuleError) {
                throw new MarketplaceOrderLifecyclePermanentError(error.message, error.safeDetails);
            }
            throw error;
        }
        return { outcome: MarketplaceOrderLifecycleOutcome.APPLIED, orderId: order.id };
    }
    return { execute };
}
