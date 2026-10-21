import { requireOffersRead } from './offer-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetOffer(deps) {
    async function execute(input) {
        requireOffersRead(deps.authorization, input.actorPermissions);
        const offer = await deps.offerQueryService.getOfferById(input.tenantId, input.offerId);
        return { offer };
    }
    return { execute };
}
