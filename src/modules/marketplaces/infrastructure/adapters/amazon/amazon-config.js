import { MarketplaceConfigurationError } from '../../../domain/marketplace-errors.js';

export const DEFAULT_AMAZON_LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

export const AMAZON_SP_API_HOST = Object.freeze({
    na: 'https://sellingpartnerapi-na.amazon.com',
    eu: 'https://sellingpartnerapi-eu.amazon.com',
    fe: 'https://sellingpartnerapi-fe.amazon.com',
});

export const AMAZON_SP_API_AWS_REGION = Object.freeze({
    na: 'us-east-1',
    eu: 'eu-west-1',
    fe: 'us-west-2',
});

/**
 * @param {Record<string, unknown>} configuration
 * @param {string | null | undefined} [deploymentLwaTokenUrl]
 */
export function resolveAmazonLwaTokenUrl(configuration, deploymentLwaTokenUrl) {
    const fromConnection = stringField(configuration, 'lwaTokenUrl');
    if (fromConnection !== null) {
        return fromConnection;
    }
    if (typeof deploymentLwaTokenUrl === 'string' && deploymentLwaTokenUrl.trim().length > 0) {
        return deploymentLwaTokenUrl.trim();
    }
    return DEFAULT_AMAZON_LWA_TOKEN_URL;
}

/**
 * @param {Record<string, unknown>} configuration
 */
export function resolveAmazonSpApiHost(configuration) {
    const regionKey = typeof configuration.region === 'string' ? configuration.region.trim() : 'na';
    const host = AMAZON_SP_API_HOST[regionKey];
    if (host === undefined) {
        throw new MarketplaceConfigurationError(`Unsupported Amazon SP-API region: ${regionKey}`);
    }
    return host;
}

/**
 * @param {Record<string, unknown>} configuration
 */
export function resolveAmazonAwsRegion(configuration) {
    const explicit = stringField(configuration, 'awsRegion');
    if (explicit !== null) {
        return explicit;
    }
    const regionKey = typeof configuration.region === 'string' ? configuration.region.trim() : 'na';
    const awsRegion = AMAZON_SP_API_AWS_REGION[regionKey];
    if (awsRegion === undefined) {
        throw new MarketplaceConfigurationError(`Unsupported Amazon SP-API region: ${regionKey}`);
    }
    return awsRegion;
}

/**
 * @param {Record<string, unknown>} credentials
 */
export function readAmazonLwaCredentials(credentials) {
    const clientId = stringField(credentials, 'clientId');
    const clientSecret = stringField(credentials, 'clientSecret');
    const refreshToken = stringField(credentials, 'refreshToken');
    if (clientId === null || clientSecret === null || refreshToken === null) {
        throw new MarketplaceConfigurationError('Amazon connection requires clientId, clientSecret, and refreshToken');
    }
    return { clientId, clientSecret, refreshToken };
}

/**
 * @param {Record<string, unknown>} credentials
 */
export function readAmazonAwsCredentials(credentials) {
    const accessKeyId = stringField(credentials, 'awsAccessKeyId');
    const secretAccessKey = stringField(credentials, 'awsSecretAccessKey');
    const sessionToken = stringField(credentials, 'awsSessionToken');
    if (accessKeyId === null || secretAccessKey === null) {
        throw new MarketplaceConfigurationError('Amazon connection requires awsAccessKeyId and awsSecretAccessKey');
    }
    return {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken === null ? {} : { sessionToken }),
    };
}

/**
 * @param {Record<string, unknown>} credentials
 */
export function readAmazonSellerId(credentials) {
    const sellerId = stringField(credentials, 'sellerId');
    if (sellerId === null) {
        throw new MarketplaceConfigurationError('Amazon connection requires sellerId');
    }
    return sellerId;
}

/**
 * @param {Record<string, unknown>} configuration
 */
export function readAmazonMarketplaceId(configuration) {
    const marketplaceId = stringField(configuration, 'marketplaceId');
    if (marketplaceId === null) {
        throw new MarketplaceConfigurationError('Amazon connection requires configuration.marketplaceId');
    }
    return marketplaceId;
}

/**
 * @param {Record<string, unknown>} configuration
 */
export function readAmazonListingsProductType(configuration) {
    const productType = stringField(configuration, 'listingsProductType');
    if (productType !== null) {
        return productType;
    }
    const legacy = stringField(configuration, 'productType');
    return legacy ?? 'PRODUCT';
}

/**
 * @param {string} externalCatalogIdentifier
 * @param {string} merchantSku
 */
export function resolveAmazonListingSku(externalCatalogIdentifier, merchantSku) {
    const fromExternal = externalCatalogIdentifier.trim();
    if (fromExternal.length > 0) {
        return fromExternal;
    }
    const fromSku = merchantSku.trim();
    if (fromSku.length > 0) {
        return fromSku;
    }
    throw new MarketplaceConfigurationError('Amazon listing sync requires offer.externalReference or merchantSku as seller SKU');
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 */
function stringField(record, key) {
    const value = record[key];
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
