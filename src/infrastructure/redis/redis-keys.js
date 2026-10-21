/**
 * Centralised Redis key construction.
 *
 * Every key in the system is built here. Scattering template literals such as
 * `` `cache:${id}` `` across modules makes collisions invisible, makes a
 * namespace migration impossible, and makes it easy to accidentally embed a
 * secret in a key (keys appear in `MONITOR`, slow logs and metrics).
 *
 * Layout: `<prefix>:<namespace>:v<schema>:<kind>:<...parts>`
 * for example `wasl:local:v1:cache:tenant-settings:abc` (prefix from `REDIS_KEY_PREFIX` + `APP_INSTANCE_NAMESPACE`).
 */
/** Bump when a key's value encoding changes incompatibly. */
const KEY_SCHEMA_VERSION = 1;
/** Characters that would break the `:`-delimited layout or pattern matching. */
const FORBIDDEN_SEGMENT = /[\s:*?[\]{}]/;

/**
 * @param {{ prefix: string, namespace: string }} dependencies
 * @returns {{
 *   root: string,
 *   cache: (namespace: string, key: string) => string,
 *   lock: (resource: string) => string,
 *   rateLimit: (policy: string, subject: string) => string,
 *   cacheNamespacePattern: (namespace: string) => string,
 *   build: (kind: string, ...parts: string[]) => string,
 * }}
 */
export function createRedisKeyBuilder(dependencies = {}) {
    const { prefix, namespace } = dependencies;
    const root = `${sanitise(prefix)}:${sanitise(namespace)}:v${KEY_SCHEMA_VERSION}`;

    /** Builds `root:kind:part1:part2...` with sanitised segments. */
    function build(kind, ...parts) {
        return [root, kind, ...parts.map(sanitise)].join(':');
    }

    /** Cache key under a logical namespace. */
    function cache(cacheNamespace, key) {
        return build('cache', cacheNamespace, key);
    }

    /** Distributed lock key for a resource id. */
    function lock(resource) {
        return build('lock', resource);
    }

    /** Rate-limit counter key; subject is base64url-encoded. */
    function rateLimit(policy, subject) {
        // Subjects may contain tenant/user ids joined with reserved `:` separators.
        return build('ratelimit', policy, encodeRateLimitSubject(subject));
    }

    /** Prefix for `SCAN MATCH`. Never use `KEYS` against a production instance. */
    function cacheNamespacePattern(cacheNamespace) {
        return `${root}:cache:${sanitise(cacheNamespace)}:*`;
    }

    return {
        root,
        cache,
        lock,
        rateLimit,
        cacheNamespacePattern,
        build,
    };
}

/**
 * @deprecated Prefer {@link createRedisKeyBuilder}; kept for existing import sites.
 * Constructor returns the factory result (same pattern as Orders service wrappers).
 */
export class RedisKeyBuilder {
    /**
     * @param {string} prefix
     * @param {string} namespace
     */
    constructor(prefix, namespace) {
        return createRedisKeyBuilder({ prefix, namespace });
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
/** Validates a single key segment; throws on empty or reserved characters. */
function sanitise(segment) {
    if (segment.length === 0) {
        throw new Error('Redis key segment must not be empty');
    }
    if (FORBIDDEN_SEGMENT.test(segment)) {
        throw new Error(`Redis key segment contains a reserved character: "${segment}"`);
    }
    return segment;
}
