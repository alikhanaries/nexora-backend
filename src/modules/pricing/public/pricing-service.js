/**
 * @typedef {object} PricingService
 * @property {(tenantId: string, productId: string, channelId: string, currency: string, at?: Date, tx?: object) => Promise<object|null>} getEffectivePrice
 * Returns the effective price DTO or null when none exists.
 * @property {(input: object, tx?: object) => Promise<object>} createPrice
 * @property {(input: object, tx?: object) => Promise<object>} updatePrice
 * @property {(input: object, tx?: object) => Promise<object>} listPrices
 * Mutations record audit/outbox events in the supplied transaction when provided.
 */
export { DefaultPricingService } from '../application/default-pricing-service.js';
