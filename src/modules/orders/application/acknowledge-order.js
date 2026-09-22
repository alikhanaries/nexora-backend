import { NotFoundError } from '../../../shared/errors/index.js';
import { requireOrdersUpdate } from './order-permissions.js';

export class AcknowledgeOrder {
    deps;

    constructor(deps) {
        this.deps = deps;
    }

    /**
     * Acknowledges an order by merchant order number (maps to Nexora `orderNumber`).
     * Delegates confirmation semantics to {@link ConfirmOrder}.
     *
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.actorId
     * @param {'user'|'api-key'} input.actorKind
     * @param {readonly string[]} input.actorPermissions
     * @param {string} input.orderNumber
     * @param {object} [input.transaction]
     */
    async execute(input) {
        requireOrdersUpdate(this.deps.authorization, input.actorPermissions);

        const work = async (tx) => {
            const existing = await this.deps.orders.findByOrderNumber(tx, input.tenantId, input.orderNumber);
            if (existing === null) {
                throw new NotFoundError('Order was not found', {
                    tenantId: input.tenantId,
                    orderNumber: input.orderNumber,
                });
            }
            const { order } = await this.deps.confirmOrder.execute({
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

        const order = await this.deps.database.execute(work, { tenantId: input.tenantId });
        return { order };
    }
}
