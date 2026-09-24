import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ValidationError } from '../errors/index.js';
import {
    assertAllowedIp,
    assertSafeOutboundHttpsUrl,
    normalizeHostname,
} from './validate-outbound-https-url.js';

/**
 * Validates that an outbound webhook URL is safe to request.
 *
 * HTTPS-only, no embedded credentials, hostname/IP must not resolve to private,
 * loopback, link-local, or metadata-service destinations.
 *
 * @param {string} rawUrl
 * @returns {Promise<URL>}
 */
export async function validateOutboundWebhookUrl(rawUrl) {
    let url;
    try {
        url = assertSafeOutboundHttpsUrl(rawUrl);
    }
    catch (error) {
        if (error instanceof ValidationError) {
            throw new ValidationError(error.message.replace(/^URL /, 'Webhook URL '));
        }
        throw error;
    }
    const hostname = normalizeHostname(url.hostname);
    const literalIpVersion = isIP(hostname);
    if (literalIpVersion !== 0) {
        return url;
    }
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) {
        throw new ValidationError('Webhook URL hostname could not be resolved');
    }
    for (const address of addresses) {
        try {
            assertAllowedIp(address.address);
        }
        catch (error) {
            if (error instanceof ValidationError) {
                throw new ValidationError(error.message.replace(/^URL /, 'Webhook URL '));
            }
            throw error;
        }
    }
    return url;
}
