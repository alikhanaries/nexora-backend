import { NotFoundError } from '../../../shared/errors/index.js';
import { requireOrdersUpdate } from './order-permissions.js';

/**
 * Acknowledges an order by merchant order number (maps to Wasl `orderNumber`).
 * Delegates confirmation semantics to {@link createConfirmOrder}.
 *
 * @param {object} deps
 * @param {{ execute: Function }} deps.confirmOrder
 * @returns {{ execute: Function }}
 */
export function createAcknowledgeOrder(deps) {
    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.actorId
     * @param {'user'|'api-key'} input.actorKind
     * @param {readonly string[]} input.actorPermissions
     * @param {string} input.orderNumber
     * @param {object} [input.transaction]
     */
    async function execute(input) {
        requireOrdersUpdate(deps.authorization, input.actorPermissions);

        /**
         * Transactional body run inside idempotency or database.execute (same tenant throughout).
         */
        const work = async (tx) => {
            const existing = await deps.orders.findByOrderNumber(tx, input.tenantId, input.orderNumber);
            if (existing === null) {
                throw new NotFoundError('Order was not found', {
                    tenantId: input.tenantId,
                    orderNumber: input.orderNumber,
                });
            }
            const { order } = await deps.confirmOrder.execute({
                tenantId: input.tenantId,
                actorId: input.actorId,
                actorKind: input.actorKind,
                actorPermissions: input.actorPermissions,
                orderId: existing.id,
                transaction: tx,
            });
            return order;
        };

        if (input.transaction !== undefined) {
            const order = await work(input.transaction);
            return { order };
        }

        const order = await deps.database.execute(work, { tenantId: input.tenantId });
        return { order };
    }

    return { execute };
}
