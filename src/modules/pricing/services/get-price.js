import { NotFoundError } from '../../../shared/errors/index.js';
import { toPriceDto } from './price-dto.js';
import { requirePricingRead } from './pricing-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetPrice(deps) {
    async function execute(input) {
        requirePricingRead(deps.authorization, input.actorPermissions);
        const price = await deps.prices.findById(deps.queryable, input.tenantId, input.priceId);
        if (price === null) {
            throw new NotFoundError('Price was not found', {
                tenantId: input.tenantId,
                priceId: input.priceId,
            });
        }
        return { price: toPriceDto(price) };
    }
    return { execute };
}
