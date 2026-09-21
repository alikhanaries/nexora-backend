/**
 * Centralised Redis key construction.
 *
 * Every key in the system is built here. Scattering template literals such as
 * `` `cache:${id}` `` across modules makes collisions invisible, makes a
 * namespace migration impossible, and makes it easy to accidentally embed a
 * secret in a key (keys appear in `MONITOR`, slow logs and metrics).
 *
 * Layout: `<prefix>:<namespace>:v<schema>:<kind>:<...parts>`
 * for example `nexora:local:v1:cache:tenant-settings:abc`.
 */
/** Bump when a key's value encoding changes incompatibly. */
const KEY_SCHEMA_VERSION = 1;
/** Characters that would break the `:`-delimited layout or pattern matching. */
const FORBIDDEN_SEGMENT = /[\s:*?[\]{}]/;
export class RedisKeyBuilder {
    root;
    constructor(prefix, namespace) {
        this.root = `${sanitise(prefix)}:${sanitise(namespace)}:v${KEY_SCHEMA_VERSION}`;
    }
    cache(namespace, key) {
        return this.build('cache', namespace, key);
    }
    lock(resource) {
        return this.build('lock', resource);
    }
    rateLimit(policy, subject) {
        // Subjects may contain tenant/user ids joined with reserved `:` separators.
        return this.build('ratelimit', policy, encodeRateLimitSubject(subject));
    }
    /** Prefix for `SCAN MATCH`. Never use `KEYS` against a production instance. */
    cacheNamespacePattern(namespace) {
        return `${this.root}:cache:${sanitise(namespace)}:*`;
    }
    build(kind, ...parts) {
        return [this.root, kind, ...parts.map(sanitise)].join(':');
    }
}
/**
 * Rejects rather than rewrites malformed segments.
 *
 * Silently replacing characters would let two distinct inputs collapse onto
 * the same key, which is a correctness bug in a cache or a lock.
 */
function encodeRateLimitSubject(subject) {
    return Buffer.from(subject, 'utf8').toString('base64url');
}
function sanitise(segment) {
    if (segment.length === 0) {
        throw new Error('Redis key segment must not be empty');
    }
    if (FORBIDDEN_SEGMENT.test(segment)) {
        throw new Error(`Redis key segment contains a reserved character: "${segment}"`);
    }
    return segment;
}
