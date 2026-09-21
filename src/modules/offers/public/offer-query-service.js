/**
 * @typedef {object} OfferQueryService
 * @property {(tenantId: string, offerId: string, tx?: object) => Promise<object>} getOfferById
 * @property {(tenantId: string, productId: string, channelId: string, tx?: object) => Promise<object|null>} getOfferForProductAndChannel
 * @property {(tenantId: string, productId: string, tx?: object) => Promise<object[]>} getOffersByProduct
 * @property {(tenantId: string, offerId: string, tx?: object) => Promise<object>} verifyOfferUsable
 */
export { DefaultOfferQueryService } from '../application/offer-query-service.js';
