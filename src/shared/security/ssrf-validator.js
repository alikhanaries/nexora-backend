import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ValidationError } from '../errors/index.js';

const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'localhost.localdomain',
    'metadata.google.internal',
]);

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
    const trimmed = rawUrl.trim();
    if (trimmed.length === 0) {
        throw new ValidationError('Webhook URL must not be empty');
    }
    let url;
    try {
        url = new URL(trimmed);
    }
    catch {
        throw new ValidationError('Webhook URL must be a valid URL');
    }
    if (url.protocol !== 'https:') {
        throw new ValidationError('Webhook URL must use HTTPS');
    }
    if (url.username.length > 0 || url.password.length > 0) {
        throw new ValidationError('Webhook URL must not contain credentials');
    }
    const hostname = normalizeHostname(url.hostname);
    if (BLOCKED_HOSTNAMES.has(hostname)) {
        throw new ValidationError('Webhook URL hostname is not allowed');
    }
    const literalIpVersion = isIP(hostname);
    if (literalIpVersion !== 0) {
        assertAllowedIp(hostname);
        return url;
    }
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) {
        throw new ValidationError('Webhook URL hostname could not be resolved');
    }
    for (const address of addresses) {
        assertAllowedIp(address.address);
    }
    return url;
}

/**
 * @param {string} ip
 */
function normalizeHostname(hostname) {
    const lower = hostname.toLowerCase();
    const bracketed = /^\[(.*)\]$/.exec(lower);
    return bracketed?.[1] ?? lower;
}

function assertAllowedIp(ip) {
    const version = isIP(ip);
    if (version === 4) {
        if (isBlockedIpv4(ip)) {
            throw new ValidationError('Webhook URL resolves to a private or restricted IPv4 address');
        }
        return;
    }
    if (version === 6) {
        if (isBlockedIpv6(ip)) {
            throw new ValidationError('Webhook URL resolves to a private or restricted IPv6 address');
        }
        return;
    }
    throw new ValidationError('Webhook URL resolves to an unsupported IP address');
}

/**
 * @param {string} ip
 */
function isBlockedIpv4(ip) {
    const parts = ip.split('.').map((part) => Number.parseInt(part, 10));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
        return true;
    }
    const [a, b] = parts;
    if (a === 127)
        return true;
    if (a === 10)
        return true;
    if (a === 172 && b >= 16 && b <= 31)
        return true;
    if (a === 192 && b === 168)
        return true;
    if (a === 169 && b === 254)
        return true;
    if (a === 0)
        return true;
    if (a >= 224)
        return true;
    return false;
}

/**
 * @param {string} ip
 */
function isBlockedIpv6(ip) {
    const normalized = ip.toLowerCase();
    if (normalized === '::' || normalized === '::1') {
        return true;
    }
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
        return true;
    }
    if (normalized.startsWith('fe80:')) {
        return true;
    }
    if (normalized.startsWith('::ffff:')) {
        const mapped = normalized.slice('::ffff:'.length);
        if (isIP(mapped) === 4) {
            return isBlockedIpv4(mapped);
        }
    }
    return false;
}
