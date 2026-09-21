import { requireOffersRead } from './offer-permissions.js';
export class GetOffer {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireOffersRead(this.deps.authorization, input.actorPermissions);
        const offer = await this.deps.offerQueryService.getOfferById(input.tenantId, input.offerId);
        return { offer };
    }
}
