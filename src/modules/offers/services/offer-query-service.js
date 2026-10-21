import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { OfferStatus } from '../models/offer-status.js';
import { toOfferDto } from './offer-dto.js';

/**
 * @param {object} deps
 */
export function createDefaultOfferQueryService(deps) {
    async function getOfferById(tenantId, offerId, tx) {
        const queryable = tx ?? deps.queryable;
        const offer = await deps.offers.findById(queryable, tenantId, offerId);
        if (offer === null) {
            throw new NotFoundError('Offer was not found', { tenantId, offerId });
        }
        return toOfferDto(offer);
    }

    return {
        getOfferById,
        async getOfferForProductAndChannel(tenantId, productId, channelId, tx) {
            const queryable = tx ?? deps.queryable;
            const offer = await deps.offers.findByProductAndChannel(queryable, tenantId, productId, channelId);
            return offer === null ? null : toOfferDto(offer);
        },
        async getOffersByProduct(tenantId, productId, tx) {
            const queryable = tx ?? deps.queryable;
            const offers = await deps.offers.listByProduct(queryable, tenantId, productId);
            return offers.map(toOfferDto);
        },
        async listActiveOffersByChannel(tenantId, channelId, tx) {
            const queryable = tx ?? deps.queryable;
            const offers = await deps.offers.listByChannel(queryable, tenantId, channelId, {
                status: OfferStatus.ACTIVE,
            });
            return offers.map(toOfferDto);
        },
        async listOffersPage(tenantId, filters, limit, cursor, tx) {
            const queryable = tx ?? deps.queryable;
            const page = await deps.offers.listPage(
                queryable,
                tenantId,
                filters,
                limit,
                cursor?.createdAt ?? null,
                cursor?.id ?? null,
            );
            const items = page.items.map(toOfferDto);
            const last = items.at(-1);
            const nextCursor = items.length === limit && last !== undefined
                ? { createdAt: last.createdAt, id: last.id }
                : null;
            return { items, nextCursor };
        },
        async verifyOfferUsable(tenantId, offerId, tx) {
            const offer = await getOfferById(tenantId, offerId, tx);
            if (offer.status !== OfferStatus.ACTIVE) {
                throw new BusinessRuleError('Offer is not usable', {
                    tenantId,
                    offerId,
                    status: offer.status,
                });
            }
            return offer;
        },
        async getOfferByExternalReference(tenantId, channelId, externalReference, tx) {
            const normalized = externalReference.trim();
            if (normalized.length === 0) {
                return null;
            }
            const queryable = tx ?? deps.queryable;
            const offer = await deps.offers.findByExternalReference(queryable, tenantId, channelId, normalized);
            return offer === null ? null : toOfferDto(offer);
        },
    };
}
