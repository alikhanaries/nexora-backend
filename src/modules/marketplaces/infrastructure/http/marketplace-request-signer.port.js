/**
 * Provider-specific request signing (e.g. AWS SigV4) applied before transport.
 *
 * @typedef {object} MarketplaceSignableRequest
 * @property {string} url
 * @property {string} [method]
 * @property {Record<string, string>} [headers]
 * @property {string | undefined} [body]
 *
 * @typedef {object} MarketplaceRequestSigner
 * @property {(request: MarketplaceSignableRequest, context: Record<string, unknown>) => Promise<MarketplaceSignableRequest>} sign
 */

export {};
