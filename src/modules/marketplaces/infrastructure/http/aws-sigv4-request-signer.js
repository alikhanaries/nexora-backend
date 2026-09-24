import { createHash, createHmac } from 'node:crypto';

const ALGORITHM = 'AWS4-HMAC-SHA256';
const EMPTY_PAYLOAD_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * AWS Signature Version 4 for SP-API (`execute-api` service).
 */
export class AwsSigV4RequestSigner {
    /**
     * @param {object} options
     * @param {string} options.region
     * @param {string} [options.service]
     * @param {() => Date} [options.now]
     */
    constructor(options) {
        this.region = options.region;
        this.service = options.service ?? 'execute-api';
        this.now = options.now ?? (() => new Date());
    }

    /**
     * @param {import('./marketplace-request-signer.port.js').MarketplaceSignableRequest} request
     * @param {Record<string, unknown>} context
     */
    async sign(request, context) {
        const accessKeyId = requiredString(context, 'accessKeyId');
        const secretAccessKey = requiredString(context, 'secretAccessKey');
        const sessionToken = optionalString(context.sessionToken);
        const date = this.now();
        const amzDate = formatAmzDate(date);
        const dateStamp = amzDate.slice(0, 8);
        const url = new URL(request.url);
        const method = (request.method ?? 'GET').toUpperCase();
        const headers = normalizeHeaderKeys({ ...(request.headers ?? {}) });
        headers.host = url.host;
        headers['x-amz-date'] = amzDate;
        if (sessionToken !== null) {
            headers['x-amz-security-token'] = sessionToken;
        }
        const payload = request.body ?? '';
        const payloadHash = sha256Hex(payload);
        headers['x-amz-content-sha256'] = payloadHash;
        const canonicalHeaders = buildCanonicalHeaders(headers);
        const signedHeaders = Object.keys(headers).sort().join(';');
        const canonicalRequest = [
            method,
            canonicalUri(url.pathname),
            canonicalQueryString(url.searchParams),
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join('\n');
        const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;
        const stringToSign = [
            ALGORITHM,
            amzDate,
            credentialScope,
            sha256Hex(canonicalRequest),
        ].join('\n');
        const signingKey = getSignatureKey(secretAccessKey, dateStamp, this.region, this.service);
        const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
        headers.authorization = `${ALGORITHM} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
        return {
            url: request.url,
            method,
            headers,
            body: request.body,
        };
    }
}

/**
 * @param {string} pathname
 */
export function canonicalUri(pathname) {
    if (pathname.length === 0) {
        return '/';
    }
    return pathname.split('/').map((segment) => encodeURIComponent(decodeURIComponent(segment))).join('/');
}

/**
 * @param {URLSearchParams} searchParams
 */
export function canonicalQueryString(searchParams) {
    const pairs = [];
    for (const key of [...searchParams.keys()].sort()) {
        for (const value of searchParams.getAll(key).sort()) {
            pairs.push(`${encodeRfc3986(key)}=${encodeRfc3986(value)}`);
        }
    }
    return pairs.join('&');
}

/**
 * @param {Record<string, string>} headers
 */
export function buildCanonicalHeaders(headers) {
    return Object.keys(headers)
        .sort()
        .map((key) => `${key}:${headers[key].trim().replace(/\s+/g, ' ')}\n`)
        .join('');
}

/**
 * @param {string} value
 */
export function sha256Hex(value) {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * @param {string} secretAccessKey
 * @param {string} dateStamp
 * @param {string} region
 * @param {string} service
 */
export function getSignatureKey(secretAccessKey, dateStamp, region, service) {
    const kDate = createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(region).digest();
    const kService = createHmac('sha256', kRegion).update(service).digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
}

/**
 * @param {Date} date
 */
export function formatAmzDate(date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

/**
 * @param {string} value
 */
function encodeRfc3986(value) {
    return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * @param {Record<string, string>} headers
 */
function normalizeHeaderKeys(headers) {
    /** @type {Record<string, string>} */
    const normalized = {};
    for (const [key, value] of Object.entries(headers)) {
        normalized[key.toLowerCase()] = value;
    }
    return normalized;
}

/**
 * @param {Record<string, unknown>} context
 * @param {string} key
 */
function requiredString(context, key) {
    const value = optionalString(context[key]);
    if (value === null) {
        throw new Error(`Missing SigV4 context field: ${key}`);
    }
    return value;
}

/**
 * @param {unknown} value
 */
function optionalString(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export { EMPTY_PAYLOAD_HASH };
