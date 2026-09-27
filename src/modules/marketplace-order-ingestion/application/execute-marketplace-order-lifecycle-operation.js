import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { MarketplaceOrderLifecycleOperation } from '../domain/marketplace-order-lifecycle-operation.js';
import { MarketplaceOrderLifecycleOutcome } from '../domain/marketplace-order-lifecycle-outcome.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../domain/normalized-marketplace-lifecycle-target-status.js';
import { MarketplaceOrderLifecyclePermanentError } from './marketplace-order-lifecycle-errors.js';
import { resolveMarketplaceLifecycleOrderLines } from './resolve-marketplace-lifecycle-order-lines.js';

const SYSTEM_ACTOR_ID = 'marketplace-order-lifecycle';
const LIFECYCLE_PERMISSIONS = Object.freeze(['orders.update', 'orders.cancel', 'cancellations.create', 'returns.create']);

/**
 * Applies a normalized lifecycle command to Nexora order services (no provider HTTP).
 */
export class ExecuteMarketplaceOrderLifecycleOperation {
    deps;

    /**
     * @param {object} deps
     * @param {{ listOrderLines: (queryable: object, tenantId: string, orderId: string) => Promise<import('../../orders/domain/order-line.js').OrderLine[]> }} deps.orders
     * @param {import('../../products/public/index.js').ProductQueryService} deps.productQueryService
     * @param {import('../../orders/application/confirm-order.js').ConfirmOrder} deps.confirmOrder
     * @param {import('../../cancellations/public/cancellation-command-service.js').DefaultCancellationCommandService} deps.cancellationCommandService
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {import('./normalized-marketplace-lifecycle-command.schema.js').normalizedMarketplaceLifecycleCommandSchema['_output']} command
     * @param {import('../../orders/domain/order.js').Order} order
     * @param {object} tx
     */
    async execute(input, command, order, tx) {
        switch (command.operation) {
            case MarketplaceOrderLifecycleOperation.STATUS_SYNC:
                return this.applyStatusSync(input, command, order, tx);
            case MarketplaceOrderLifecycleOperation.CANCEL_ORDER:
                return this.applyCancelOrder(input, command, order, tx);
            case MarketplaceOrderLifecycleOperation.UPDATE_ORDER:
                return { outcome: MarketplaceOrderLifecycleOutcome.NOOP, orderId: order.id };
            case MarketplaceOrderLifecycleOperation.RETURN_ORDER:
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
     * @param {import('../../orders/domain/order.js').Order} order
     * @param {object} tx
     */
    async applyStatusSync(input, command, order, tx) {
        if (command.targetStatus === NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN) {
            return { outcome: MarketplaceOrderLifecycleOutcome.NOOP, orderId: order.id };
        }
        if (command.targetStatus === NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED) {
            if (order.status === 'CONFIRMED') {
                return { outcome: MarketplaceOrderLifecycleOutcome.DUPLICATE, orderId: order.id };
            }
            await this.deps.confirmOrder.execute({
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
            return this.applyCancelOrder(input, {
                ...command,
                operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
                lines: undefined,
            }, order, tx);
        }
        throw new MarketplaceOrderLifecyclePermanentError('Target status is not supported for synchronization', {
            targetStatus: command.targetStatus,
        });
    }

    /**
     * @param {object} input
     * @param {object} command
     * @param {import('../../orders/domain/order.js').Order} order
     * @param {object} tx
     */
    async applyCancelOrder(input, command, order, tx) {
        if (order.status === 'CANCELLED') {
            return { outcome: MarketplaceOrderLifecycleOutcome.DUPLICATE, orderId: order.id };
        }
        const lines = await resolveMarketplaceLifecycleOrderLines({
            orders: this.deps.orders,
            productQueryService: this.deps.productQueryService,
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
            await this.deps.cancellationCommandService.createCancellation({
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
}
