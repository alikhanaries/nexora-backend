import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ValidationError } from '../../../shared/errors/index.js';
import {
    assertAllowedIp,
    assertSafeOutboundHttpsUrl,
    normalizeHostname,
} from '../../../shared/security/validate-outbound-https-url.js';

const OUTBOUND_URL_KEYS = ['apiBaseUrl', 'lwaTokenUrl'];

/**
 * Validates marketplace connection configuration URLs before persistence.
 *
 * @param {Record<string, unknown>} configuration
 */
export async function validateMarketplaceConnectionConfiguration(configuration) {
    for (const key of OUTBOUND_URL_KEYS) {
        const value = configuration[key];
        if (typeof value !== 'string' || value.trim().length === 0) {
            continue;
        }
        await validateOutboundHttpsUrlWithDns(value.trim());
    }
}

/**
 * @param {string} rawUrl
 */
async function validateOutboundHttpsUrlWithDns(rawUrl) {
    const url = assertSafeOutboundHttpsUrl(rawUrl);
    const hostname = normalizeHostname(url.hostname);
    if (isIP(hostname) !== 0) {
        return url;
    }
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) {
        throw new ValidationError('URL hostname could not be resolved');
    }
    for (const address of addresses) {
        assertAllowedIp(address.address);
    }
    return url;
}
