import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { OfferStatus } from '../models/offer-status.js';
import { toOfferDto } from './offer-dto.js';

/**
 * @param {object} deps
 */
export function createDefaultOfferQueryService(deps) {
/**
     * Loads one offer DTO for the tenant or throws when missing.
     * @param {string} tenantId Tenant scope.
     * @param {string} offerId Offer primary key.
     */
    async function getOfferById(tenantId, offerId, tx) {
        const queryable = tx ?? deps.queryable;
        const offer = await deps.offers.findById(queryable, tenantId, offerId);
        if (offer === null) {
            throw new NotFoundError('Offer was not found', { tenantId, offerId });
        }
        return toOfferDto(offer);
    }

/** Repository operation on offer data (tenant-isolated SQL). */
    async function getOffersByProduct(tenantId, productId, tx) {
        if (tx === undefined) {
            return deps.transactionManager.execute(
                (innerTx) => getOffersByProduct(tenantId, productId, innerTx),
                { tenantId },
            );
        }
        const offers = await deps.offers.listByProduct(tx, tenantId, productId);
        return offers.map(toOfferDto);
    }

    return {
        getOfferById,
/** Repository operation on offer data (tenant-isolated SQL). */
        async getOfferForProductAndChannel(tenantId, productId, channelId, tx) {
            const queryable = tx ?? deps.queryable;
            const offer = await deps.offers.findByProductAndChannel(queryable, tenantId, productId, channelId);
            return offer === null ? null : toOfferDto(offer);
        },
        getOffersByProduct,
/** Lists child rows for a offer within the tenant. */
        async listActiveOffersByChannel(tenantId, channelId, tx) {
            const queryable = tx ?? deps.queryable;
            const offers = await deps.offers.listByChannel(queryable, tenantId, channelId, {
                status: OfferStatus.ACTIVE,
            });
            return offers.map(toOfferDto);
        },
/** Lists child rows for a offer within the tenant. */
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
/** Ensures an offer exists, belongs to the tenant, and is in an active/sellable state. */
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
/** Repository operation on offer data (tenant-isolated SQL). */
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
