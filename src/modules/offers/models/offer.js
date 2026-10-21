import { BusinessRuleError } from '../../../shared/errors/index.js';
import { ListingStatus } from './listing-status.js';
import { OfferStatus } from './offer-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   productId: string,
 *   channelId: string,
 *   status: string,
 *   externalReference: string | null,
 *   priceReference: string | null,
 *   listingStatus: string,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} Offer
 */

/**
 * @param {object} props
 * @returns {Offer}
 */
export function createOfferEntity(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        productId: props.productId,
        channelId: props.channelId,
        status: OfferStatus.DRAFT,
        externalReference: props.externalReference ?? null,
        priceReference: props.priceReference ?? null,
        listingStatus: ListingStatus.UNLISTED,
        createdAt: props.createdAt,
        updatedAt: props.createdAt,
    };
}

/**
 * @param {Offer} props
 * @returns {Offer}
 */
export function reconstituteOffer(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        productId: props.productId,
        channelId: props.channelId,
        status: props.status,
        externalReference: props.externalReference,
        priceReference: props.priceReference,
        listingStatus: props.listingStatus,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {Offer} offer
 * @returns {boolean}
 */
export function isOfferUsable(offer) {
    return offer.status === OfferStatus.ACTIVE;
}

/**
 * @param {Offer} offer
 * @param {object} fields
 * @param {Date} at
 * @returns {Offer}
 */
export function updateOfferEntity(offer, fields, at) {
    if (offer.status === OfferStatus.INACTIVE) {
        throw new BusinessRuleError('Inactive offers cannot be updated');
    }
    return {
        id: offer.id,
        tenantId: offer.tenantId,
        productId: offer.productId,
        channelId: offer.channelId,
        status: offer.status,
        externalReference: fields.externalReference === undefined ? offer.externalReference : fields.externalReference,
        priceReference: fields.priceReference === undefined ? offer.priceReference : fields.priceReference,
        listingStatus: fields.listingStatus ?? offer.listingStatus,
        createdAt: offer.createdAt,
        updatedAt: at,
    };
}

/**
 * @param {Offer} offer
 * @param {string} status
 * @param {Date} updatedAt
 * @returns {Offer}
 */
function withOfferStatus(offer, status, updatedAt) {
    return {
        id: offer.id,
        tenantId: offer.tenantId,
        productId: offer.productId,
        channelId: offer.channelId,
        status,
        externalReference: offer.externalReference,
        priceReference: offer.priceReference,
        listingStatus: offer.listingStatus,
        createdAt: offer.createdAt,
        updatedAt,
    };
}

/**
 * @param {Offer} offer
 * @param {Date} at
 * @returns {Offer}
 */
export function activateOfferEntity(offer, at) {
    if (offer.status !== OfferStatus.DRAFT && offer.status !== OfferStatus.SUSPENDED) {
        throw new BusinessRuleError('Only draft or suspended offers can be activated', {
            currentStatus: offer.status,
        });
    }
    return withOfferStatus(offer, OfferStatus.ACTIVE, at);
}

/**
 * @param {Offer} offer
 * @param {Date} at
 * @returns {Offer}
 */
export function suspendOfferEntity(offer, at) {
    if (offer.status !== OfferStatus.ACTIVE) {
        throw new BusinessRuleError('Only active offers can be suspended', {
            currentStatus: offer.status,
        });
    }
    return withOfferStatus(offer, OfferStatus.SUSPENDED, at);
}

/**
 * @param {Offer} offer
 * @param {Date} at
 * @returns {Offer}
 */
export function deactivateOfferEntity(offer, at) {
    if (offer.status === OfferStatus.INACTIVE) {
        throw new BusinessRuleError('Offer is already inactive');
    }
    return withOfferStatus(offer, OfferStatus.INACTIVE, at);
}
