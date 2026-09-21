import { requirePricingRead } from './pricing-permissions.js';
export class ListPrices {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requirePricingRead(this.deps.authorization, input.actorPermissions);
        return this.deps.pricingService.listPrices({
            tenantId: input.tenantId,
            ...(input.limit === undefined ? {} : { limit: input.limit }),
            ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
            ...(input.productId === undefined ? {} : { productId: input.productId }),
            ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            ...(input.currency === undefined ? {} : { currency: input.currency }),
            ...(input.status === undefined ? {} : { status: input.status }),
        });
    }
}
