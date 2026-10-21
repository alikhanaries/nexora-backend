import { requireOffersRead } from './offer-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetOffer(deps) {
/** Application workflow entry for this command/query (tenant-scoped, permission-checked). */
    async function execute(input) {
        requireOffersRead(deps.authorization, input.actorPermissions);
        const offer = await deps.offerQueryService.getOfferById(input.tenantId, input.offerId);
        return { offer };
    }
    return { execute };
}
