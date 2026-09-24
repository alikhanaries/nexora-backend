import { MarketplaceConfigurationError } from '../../../domain/marketplace-errors.js';

export const DEFAULT_NOON_API_BASE_URL = 'https://noon-api-gateway.noon.partners';
export const DEFAULT_NOON_USER_AGENT = 'Nexora/1.0';

const NOON_COUNTRY_CODES = new Set(['ae', 'sa', 'eg']);

/**
 * @param {Record<string, unknown>} configuration
 * @param {string | null | undefined} [deploymentApiBaseUrl]
 */
export function resolveNoonApiBaseUrl(configuration, deploymentApiBaseUrl) {
    const fromConnection = stringField(configuration, 'apiBaseUrl');
    if (fromConnection !== null) {
        return fromConnection.replace(/\/+$/, '');
    }
    if (typeof deploymentApiBaseUrl === 'string' && deploymentApiBaseUrl.trim().length > 0) {
        return deploymentApiBaseUrl.trim().replace(/\/+$/, '');
    }
    return DEFAULT_NOON_API_BASE_URL;
}

/**
 * @param {Record<string, unknown>} configuration
 * @param {string | null | undefined} [deploymentUserAgent]
 */
export function resolveNoonUserAgent(configuration, deploymentUserAgent) {
    const fromConnection = stringField(configuration, 'userAgent');
    if (fromConnection !== null) {
        return fromConnection;
    }
    if (typeof deploymentUserAgent === 'string' && deploymentUserAgent.trim().length > 0) {
        return deploymentUserAgent.trim();
    }
    return DEFAULT_NOON_USER_AGENT;
}

/**
 * @param {Record<string, unknown>} configuration
 */
export function readNoonCountryCode(configuration) {
    const countryCode = stringField(configuration, 'countryCode');
    if (countryCode === null) {
        throw new MarketplaceConfigurationError('Noon connection requires configuration.countryCode (ae, sa, or eg)');
    }
    const normalized = countryCode.toLowerCase();
    if (!NOON_COUNTRY_CODES.has(normalized)) {
        throw new MarketplaceConfigurationError('Noon countryCode must be one of: ae, sa, eg');
    }
    return normalized;
}

/**
 * @param {Record<string, unknown>} configuration
 */
export function readNoonWarehouseCode(configuration) {
    const warehouseCode = stringField(configuration, 'warehouseCode');
    if (warehouseCode === null) {
        throw new MarketplaceConfigurationError('Noon connection requires configuration.warehouseCode');
    }
    return warehouseCode;
}

/**
 * @param {Record<string, unknown>} credentials
 * @param {Record<string, unknown>} configuration
 */
export function readNoonServiceAccount(credentials, configuration) {
    const keyId = stringField(credentials, 'keyId') ?? stringField(credentials, 'key_id');
    const privateKeyRaw = stringField(credentials, 'privateKey') ?? stringField(credentials, 'private_key');
    const projectCode = stringField(credentials, 'projectCode')
        ?? stringField(credentials, 'project_code')
        ?? stringField(configuration, 'projectCode');
    if (keyId === null || privateKeyRaw === null || projectCode === null) {
        throw new MarketplaceConfigurationError(
            'Noon connection requires credentials keyId, privateKey, and projectCode (or project_code)',
        );
    }
    return {
        keyId,
        privateKeyPem: normalizePrivateKeyPem(privateKeyRaw),
        projectCode,
    };
}

/**
 * @param {string} externalCatalogIdentifier
 * @param {string} merchantSku
 */
export function resolveNoonPartnerSku(externalCatalogIdentifier, merchantSku) {
    const fromExternal = externalCatalogIdentifier.trim();
    if (fromExternal.length > 0) {
        return fromExternal;
    }
    const fromSku = merchantSku.trim();
    if (fromSku.length > 0) {
        return fromSku;
    }
    throw new MarketplaceConfigurationError(
        'Noon catalog sync requires offer.externalReference or merchantSku as partner_sku',
    );
}

/**
 * @param {string} pem
 */
function normalizePrivateKeyPem(pem) {
    return pem.replace(/\\n/g, '\n').trim();
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
