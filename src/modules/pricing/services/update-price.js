import { auditRequestFields } from '../../audit/public/index.js';
import { requirePricingUpdate } from './pricing-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createUpdatePrice(deps) {
    async function execute(input) {
        requirePricingUpdate(deps.authorization, input.actorPermissions);
        const price = await deps.database.execute(async (tx) => {
            const updated = await deps.pricingService.updatePrice({
                tenantId: input.tenantId,
                priceId: input.priceId,
                ...(input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor }),
                ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }),
                ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
                ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            }, tx);
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'PRICE_UPDATED',
                resourceType: 'price',
                resourceId: updated.id,
                metadata: {
                    productId: updated.productId,
                    channelId: updated.channelId,
                },
                ...auditRequestFields(),
            });
            return updated;
        }, { tenantId: input.tenantId });
        return { price };
    }
    return { execute };
}
