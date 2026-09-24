import { MarketplaceConfigurationError } from '../../../domain/marketplace-errors.js';

/** Default Admin API version when connection config and deployment default are unset. */
export const DEFAULT_SHOPIFY_ADMIN_API_VERSION = '2024-10';

/**
 * @param {Record<string, unknown>} configuration
 * @param {string | null | undefined} [deploymentDefaultApiVersion]
 */
export function resolveShopifyAdminApiVersion(configuration, deploymentDefaultApiVersion) {
    const connectionVersion = typeof configuration.apiVersion === 'string'
        ? configuration.apiVersion.trim()
        : '';
    if (connectionVersion.length > 0) {
        return connectionVersion;
    }
    const deploymentVersion = typeof deploymentDefaultApiVersion === 'string'
        ? deploymentDefaultApiVersion.trim()
        : '';
    if (deploymentVersion.length > 0) {
        return deploymentVersion;
    }
    return DEFAULT_SHOPIFY_ADMIN_API_VERSION;
}

/**
 * @param {Record<string, unknown>} credentials
 */
export function readShopifyCredentials(credentials) {
    const shopDomain = normalizeShopDomain(credentials.shopDomain);
    const accessToken = typeof credentials.accessToken === 'string' ? credentials.accessToken.trim() : '';
    if (shopDomain.length === 0 || accessToken.length === 0) {
        throw new MarketplaceConfigurationError('Shopify connection requires shopDomain and accessToken');
    }
    return { shopDomain, accessToken };
}

/**
 * @param {unknown} shopDomain
 */
export function normalizeShopDomain(shopDomain) {
    if (typeof shopDomain !== 'string') {
        return '';
    }
    let normalized = shopDomain.trim().toLowerCase();
    if (normalized.length === 0) {
        return '';
    }
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.split('/')[0] ?? normalized;
    if (!normalized.includes('.')) {
        normalized = `${normalized}.myshopify.com`;
    }
    return normalized;
}

/**
 * @param {Record<string, unknown>} configuration
 */
export function readShopifyLocationId(configuration) {
    const locationId = typeof configuration.shopifyLocationId === 'string'
        ? configuration.shopifyLocationId.trim()
        : '';
    if (locationId.length === 0) {
        throw new MarketplaceConfigurationError('Shopify inventory sync requires configuration.shopifyLocationId');
    }
    return locationId.startsWith('gid://') ? locationId : `gid://shopify/Location/${locationId}`;
}

/**
 * @param {string} externalCatalogIdentifier
 */
export function toShopifyVariantGid(externalCatalogIdentifier) {
    if (externalCatalogIdentifier.startsWith('gid://')) {
        return externalCatalogIdentifier;
    }
    return `gid://shopify/ProductVariant/${externalCatalogIdentifier}`;
}
