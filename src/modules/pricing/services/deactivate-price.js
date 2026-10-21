import { auditRequestFields } from '../../audit/public/index.js';
import { requirePricingUpdate } from './pricing-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createDeactivatePrice(deps) {
    async function execute(input) {
        requirePricingUpdate(deps.authorization, input.actorPermissions);
        const price = await deps.database.execute(async (tx) => {
            const deactivated = await deps.pricingService.deactivatePrice({
                tenantId: input.tenantId,
                priceId: input.priceId,
            }, tx);
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'PRICE_DEACTIVATED',
                resourceType: 'price',
                resourceId: deactivated.id,
                metadata: {
                    productId: deactivated.productId,
                    channelId: deactivated.channelId,
                },
                ...auditRequestFields(),
            });
            return deactivated;
        }, { tenantId: input.tenantId });
        return { price };
    }
    return { execute };
}
