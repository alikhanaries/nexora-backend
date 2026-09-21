import { NotFoundError } from '../../../shared/errors/index.js';
import { toPriceDto } from './price-dto.js';
import { requirePricingRead } from './pricing-permissions.js';
export class GetPrice {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requirePricingRead(this.deps.authorization, input.actorPermissions);
        const price = await this.deps.prices.findById(this.deps.queryable, input.tenantId, input.priceId);
        if (price === null) {
            throw new NotFoundError('Price was not found', {
                tenantId: input.tenantId,
                priceId: input.priceId,
            });
        }
        return { price: toPriceDto(price) };
    }
}
