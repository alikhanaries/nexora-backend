import { DEFAULT_NOON_API_BASE_URL } from './noon-config.js';

/** Hostname of the default Noon Partners production API gateway. */
export const NOON_PRODUCTION_PARTNERS_HOST = 'noon-api-gateway.noon.partners';

/**
 * @param {string | null | undefined} baseUrl
 * @returns {'production_partners' | 'custom' | 'unknown'}
 */
export function classifyNoonGatewayUrl(baseUrl) {
    if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
        return 'production_partners';
    }
    try {
        const host = new URL(baseUrl.trim()).hostname.toLowerCase();
        if (host === NOON_PRODUCTION_PARTNERS_HOST) {
            return 'production_partners';
        }
        return 'custom';
    }
    catch {
        return 'unknown';
    }
}

/**
 * Effective deployment gateway classification (env override or default production).
 *
 * @param {string | null | undefined} deploymentApiBaseUrl
 */
export function classifyNoonDeploymentGateway(deploymentApiBaseUrl) {
    const effective = typeof deploymentApiBaseUrl === 'string' && deploymentApiBaseUrl.trim().length > 0
        ? deploymentApiBaseUrl.trim()
        : DEFAULT_NOON_API_BASE_URL;
    return {
        classification: classifyNoonGatewayUrl(effective),
        usesDefaultWhenUnset: !(typeof deploymentApiBaseUrl === 'string' && deploymentApiBaseUrl.trim().length > 0),
    };
}
