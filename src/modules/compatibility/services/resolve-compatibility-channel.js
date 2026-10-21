/**
 * Resolves commerce integration channel + stock location for compatibility v2 catalog/order calls.
 */
import { ValidationError } from '../../../shared/errors/index.js';
import { resolveChannelStockLocationId } from '../../commerce-integrations/public/index.js';

/**
 * Resolves channel context for Merchant-compatible catalog/offer calls.
 *
 * Precedence: API-key channel scope → `X-Channel-Reference` → body `ChannelId` (stringified external ref).
 *
 * @param {object} deps
 * @param {import('../../commerce-integrations/public/commerce-integration-query-service.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string|null|undefined} input.apiKeyChannelId
 * @param {string|null|undefined} input.channelExternalReference
 * @param {string|number|null|undefined} input.bodyChannelId
 */
export async function resolveCompatibilityChannel(deps, input) {
    if (input.apiKeyChannelId !== undefined && input.apiKeyChannelId !== null) {
        const channel = await deps.commerceIntegrationQueryService.getCommerceIntegrationById(input.tenantId, input.apiKeyChannelId);
        return channel;
    }
    const headerRef = input.channelExternalReference?.trim();
    if (headerRef !== undefined && headerRef.length > 0) {
        return deps.commerceIntegrationQueryService.getCommerceIntegrationByExternalReference(input.tenantId, headerRef);
    }
    if (input.bodyChannelId !== undefined && input.bodyChannelId !== null && String(input.bodyChannelId).length > 0) {
        return deps.commerceIntegrationQueryService.getCommerceIntegrationByExternalReference(
            input.tenantId,
            String(input.bodyChannelId),
        );
    }
    throw new ValidationError(
        'Channel context is required (API key channel scope, X-Channel-Reference header, or ChannelId on the request body)',
    );
}

/**
 * @param {object} channel
 * @returns {string}
 */
export function resolveCompatibilityStockLocationId(channel) {
    return resolveChannelStockLocationId(channel);
}
