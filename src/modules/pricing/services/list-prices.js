import { requirePricingRead } from './pricing-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createListPrices(deps) {
    async function execute(input) {
        requirePricingRead(deps.authorization, input.actorPermissions);
        return deps.pricingService.listPrices({
            tenantId: input.tenantId,
            ...(input.limit === undefined ? {} : { limit: input.limit }),
            ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
            ...(input.productId === undefined ? {} : { productId: input.productId }),
            ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            ...(input.currency === undefined ? {} : { currency: input.currency }),
            ...(input.status === undefined ? {} : { status: input.status }),
        });
    }
    return { execute };
}
