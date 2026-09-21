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

export type KeyKind = 'cache' | 'lock' | 'ratelimit';

/** Characters that would break the `:`-delimited layout or pattern matching. */
const FORBIDDEN_SEGMENT = /[\s:*?[\]{}]/;

export class RedisKeyBuilder {
  private readonly root: string;

  constructor(prefix: string, namespace: string) {
    this.root = `${sanitise(prefix)}:${sanitise(namespace)}:v${KEY_SCHEMA_VERSION}`;
  }

  cache(namespace: string, key: string): string {
    return this.build('cache', namespace, key);
  }

  lock(resource: string): string {
    return this.build('lock', resource);
  }

  rateLimit(policy: string, subject: string): string {
    return this.build('ratelimit', policy, subject);
  }

  /** Prefix for `SCAN MATCH`. Never use `KEYS` against a production instance. */
  cacheNamespacePattern(namespace: string): string {
    return `${this.root}:cache:${sanitise(namespace)}:*`;
  }

  private build(kind: KeyKind, ...parts: readonly string[]): string {
    return [this.root, kind, ...parts.map(sanitise)].join(':');
  }
}

/**
 * Rejects rather than rewrites malformed segments.
 *
 * Silently replacing characters would let two distinct inputs collapse onto
 * the same key, which is a correctness bug in a cache or a lock.
 */
function sanitise(segment: string): string {
  if (segment.length === 0) {
    throw new Error('Redis key segment must not be empty');
  }
  if (FORBIDDEN_SEGMENT.test(segment)) {
    throw new Error(`Redis key segment contains a reserved character: "${segment}"`);
  }
  return segment;
}
