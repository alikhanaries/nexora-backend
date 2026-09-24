import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { OfferStatus } from '../domain/offer-status.js';
import { toOfferDto } from './offer-dto.js';
export class DefaultOfferQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getOfferById(tenantId, offerId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const offer = await this.deps.offers.findById(queryable, tenantId, offerId);
        if (offer === null) {
            throw new NotFoundError('Offer was not found', { tenantId, offerId });
        }
        return toOfferDto(offer);
    }
    async getOfferForProductAndChannel(tenantId, productId, channelId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const offer = await this.deps.offers.findByProductAndChannel(queryable, tenantId, productId, channelId);
        return offer === null ? null : toOfferDto(offer);
    }
    async getOffersByProduct(tenantId, productId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const offers = await this.deps.offers.listByProduct(queryable, tenantId, productId);
        return offers.map(toOfferDto);
    }
    async listActiveOffersByChannel(tenantId, channelId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const offers = await this.deps.offers.listByChannel(queryable, tenantId, channelId, {
            status: OfferStatus.ACTIVE,
        });
        return offers.map(toOfferDto);
    }
    async verifyOfferUsable(tenantId, offerId, tx) {
        const offer = await this.getOfferById(tenantId, offerId, tx);
        if (offer.status !== OfferStatus.ACTIVE) {
            throw new BusinessRuleError('Offer is not usable', {
                tenantId,
                offerId,
                status: offer.status,
            });
        }
        return offer;
    }
    async getOfferByExternalReference(tenantId, channelId, externalReference, tx) {
        const normalized = externalReference.trim();
        if (normalized.length === 0) {
            return null;
        }
        const queryable = tx ?? this.deps.queryable;
        const offer = await this.deps.offers.findByExternalReference(queryable, tenantId, channelId, normalized);
        return offer === null ? null : toOfferDto(offer);
    }
}
