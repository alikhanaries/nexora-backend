import { auditRequestFields } from '../../audit/public/index.js';
import { requirePricingUpdate } from './pricing-permissions.js';
export class DeactivatePrice {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requirePricingUpdate(this.deps.authorization, input.actorPermissions);
        const price = await this.deps.database.execute(async (tx) => {
            const deactivated = await this.deps.pricingService.deactivatePrice({
                tenantId: input.tenantId,
                priceId: input.priceId,
            }, tx);
            await this.deps.auditRecorder?.record(tx, {
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
}
