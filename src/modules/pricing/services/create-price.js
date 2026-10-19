import { auditRequestFields } from '../../audit/public/index.js';
import { requirePricingCreate } from './pricing-permissions.js';
export class CreatePrice {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requirePricingCreate(this.deps.authorization, input.actorPermissions);
        const price = await this.deps.database.execute(async (tx) => {
            const created = await this.deps.pricingService.createPrice({
                tenantId: input.tenantId,
                productId: input.productId,
                currency: input.currency,
                amountMinor: input.amountMinor,
                ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
                ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }),
                ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
            }, tx);
            await this.deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'PRICE_CREATED',
                resourceType: 'price',
                resourceId: created.id,
                metadata: {
                    productId: created.productId,
                    channelId: created.channelId,
                    currency: created.currency,
                    amountMinor: created.amountMinor,
                },
                ...auditRequestFields(),
            });
            return created;
        }, { tenantId: input.tenantId });
        return { price };
    }
}
