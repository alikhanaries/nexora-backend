/**
 * Provider-specific inbound marketplace webhook adapter (Phase 32).
 *
 * @typedef {object} MarketplaceWebhookCapabilities
 * @property {boolean} supportsInboundWebhooks
 *
 * @typedef {Record<string, string | string[] | undefined>} MarketplaceWebhookHeaderMap
 *
 * @typedef {object} MarketplaceWebhookConnectionContext
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} connectionId
 *
 * @typedef {object} MarketplaceWebhookRequestContext
 * @property {MarketplaceWebhookHeaderMap} headers
 * @property {string} rawBody
 * @property {MarketplaceWebhookConnectionContext} connection
 *
 * @typedef {import('../application/normalized-marketplace-webhook-event.schema.js').NormalizedMarketplaceWebhookEvent} NormalizedMarketplaceWebhookEvent
 *
 * @typedef {object} MarketplaceWebhookAdapter
 * @property {string} marketplaceKey
 * @property {() => MarketplaceWebhookCapabilities} getWebhookCapabilities
 * @property {(context: MarketplaceWebhookRequestContext) => Promise<void>} authenticateWebhookRequest
 * @property {(context: MarketplaceWebhookRequestContext) => Promise<NormalizedMarketplaceWebhookEvent>} normalizeWebhookEvent
 */

export {};
