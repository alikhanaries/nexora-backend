/** Value substituted for anything sensitive. */
export const REDACTED = '[REDACTED]';
/**
 * Field names that must never reach the log pipeline in clear text.
 * Matching is case-insensitive and ignores `-`/`_` so `api_key`, `apiKey` and
 * `API-KEY` are all covered.
 */
const SENSITIVE_KEYS = [
    'authorization',
    'proxyauthorization',
    'cookie',
    'setcookie',
    'password',
    'newpassword',
    'currentpassword',
    'passwordconfirmation',
    'token',
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'bearertoken',
    'sessiontoken',
    'apikey',
    'xapikey',
    'xcekey',
    'secret',
    'clientsecret',
    'privatekey',
    'credentials',
    'connectionstring',
    'databaseurl',
    'otp',
    'mfacode',
    'totp',
    'recoverycode',
    'cardnumber',
    'cvv',
    'iban',
];
/** Field names carrying personal data: kept but masked, not dropped. */
const PII_KEYS = [
    'email',
    'emailaddress',
    'phone',
    'phonenumber',
    'firstname',
    'lastname',
    'fullname',
    'street',
    'streetname',
    'housenumber',
    'addressline1',
    'addressline2',
    'zipcode',
    'postalcode',
];
function normaliseKey(key) {
    return key.toLowerCase().replace(/[-_\s]/g, '');
}
const SENSITIVE_SET = new Set(SENSITIVE_KEYS);
const PII_SET = new Set(PII_KEYS);
export function isSensitiveKey(key) {
    return SENSITIVE_SET.has(normaliseKey(key));
}
export function isPiiKey(key) {
    return PII_SET.has(normaliseKey(key));
}
/**
 * Pino redaction paths.
 *
 * Pino's redaction works on fixed paths, so this list covers the request and
 * response shapes we actually log. `redactDeep` handles arbitrary payloads.
 */
export const PINO_REDACT_PATHS = [
    'req.headers.authorization',
    'req.headers["proxy-authorization"]',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
    'req.headers["x-ce-key"]',
    'res.headers["set-cookie"]',
    'headers.authorization',
    'headers.cookie',
    'headers["set-cookie"]',
    'headers["x-api-key"]',
    'headers["x-ce-key"]',
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'clientSecret',
    '*.password',
    '*.token',
    '*.accessToken',
    '*.refreshToken',
    '*.apiKey',
    '*.secret',
    '*.clientSecret',
];
/**
 * Masks an email as `j***@example.com`: enough to correlate reports, not
 * enough to be a usable contact record in a log store.
 */
export function maskEmail(value) {
    const at = value.indexOf('@');
    if (at <= 0)
        return REDACTED;
    const local = value.slice(0, at);
    const domain = value.slice(at + 1);
    return `${local.slice(0, 1)}***@${domain}`;
}
/** Keeps the last `visible` characters so a value stays traceable. */
export function maskTail(value, visible = 4) {
    if (value.length <= visible)
        return REDACTED;
    return `${REDACTED}${value.slice(-visible)}`;
}
function maskPiiValue(key, value) {
    const normalised = normaliseKey(key);
    if (normalised === 'email' || normalised === 'emailaddress')
        return maskEmail(value);
    return REDACTED;
}
const MAX_DEPTH = 8;
/**
 * Recursively redacts secrets and masks PII in an arbitrary value.
 *
 * Use this before logging anything whose shape is not statically known -
 * upstream responses, webhook payloads, job data.
 */
export function redactDeep(value, depth = 0) {
    if (depth > MAX_DEPTH)
        return '[TRUNCATED]';
    if (value === null || typeof value !== 'object')
        return value;
    if (Array.isArray(value)) {
        return value.map((entry) => redactDeep(entry, depth + 1));
    }
    if (value instanceof Date)
        return value.toISOString();
    if (value instanceof Error)
        return { name: value.name, message: value.message };
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
        if (isSensitiveKey(key)) {
            result[key] = REDACTED;
        }
        else if (isPiiKey(key) && typeof entry === 'string') {
            result[key] = maskPiiValue(key, entry);
        }
        else {
            result[key] = redactDeep(entry, depth + 1);
        }
    }
    return result;
}
/** Strips credentials and query strings before a URL is logged. */
export function redactUrl(rawUrl) {
    const parsed = URL.parse(rawUrl);
    if (parsed === null)
        return '[UNPARSEABLE_URL]';
    if (parsed.username !== '' || parsed.password !== '') {
        parsed.username = REDACTED;
        parsed.password = '';
    }
    // Query strings routinely carry tokens and personal identifiers.
    const query = parsed.search === '' ? '' : '?[REDACTED_QUERY]';
    return `${parsed.origin}${parsed.pathname}${query}`;
}
