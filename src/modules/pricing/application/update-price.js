import { auditRequestFields } from '../../audit/public/index.js';
import { requirePricingUpdate } from './pricing-permissions.js';
export class UpdatePrice {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requirePricingUpdate(this.deps.authorization, input.actorPermissions);
        const price = await this.deps.database.execute(async (tx) => {
            const updated = await this.deps.pricingService.updatePrice({
                tenantId: input.tenantId,
                priceId: input.priceId,
                ...(input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor }),
                ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }),
                ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
                ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            }, tx);
            await this.deps.auditRecorder?.record(tx, {
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
}
