import { describe, expect, it } from 'vitest';
import {
    createRedisKeyBuilder,
    RedisKeyBuilder,
} from '../../../src/infrastructure/redis/redis-keys.js';

const DEFAULT_PREFIX = 'wasl';
const DEFAULT_NAMESPACE = 'local';

/** Characterisation baselines from the pre-factory RedisKeyBuilder contract. */
const EXPECTED = {
    root: 'wasl:local:v1',
    cache: 'wasl:local:v1:cache:tenant-settings:abc',
    lock: 'wasl:local:v1:lock:order-fulfillment-tenant-1',
    rateLimitSubject: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:user:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb:read',
    rateLimitEncoded:
        'YWFhYWFhYWEtYWFhYS1hYWFhLWFhYWEtYWFhYWFhYWFhYWFhOnVzZXI6YmJiYmJiYmItYmJiYi1iYmJiLWJiYmItYmJiYmJiYmJiYmJiOnJlYWQ',
    cachePattern: 'wasl:local:v1:cache:tenant-settings:*',
};

function defaultBuilder() {
    return createRedisKeyBuilder({
        prefix: DEFAULT_PREFIX,
        namespace: DEFAULT_NAMESPACE,
    });
}

describe('createRedisKeyBuilder', () => {
    it('builds the root from prefix, instance namespace, and schema version', () => {
        const keys = defaultBuilder();
        expect(keys.root).toBe(EXPECTED.root);
    });

    it('builds cache keys with exact historical format', () => {
        const keys = defaultBuilder();
        expect(keys.cache('tenant-settings', 'abc')).toBe(EXPECTED.cache);
    });

    it('builds lock keys with exact historical format', () => {
        const keys = defaultBuilder();
        expect(keys.lock('order-fulfillment-tenant-1')).toBe(EXPECTED.lock);
    });

    it('base64url-encodes rate-limit subjects so reserved separators stay in the subject', () => {
        const keys = defaultBuilder();
        expect(keys.rateLimit('compat-read', EXPECTED.rateLimitSubject)).toBe(
            `wasl:local:v1:ratelimit:compat-read:${EXPECTED.rateLimitEncoded}`,
        );
        expect(Buffer.from(EXPECTED.rateLimitEncoded, 'base64url').toString('utf8')).toBe(
            EXPECTED.rateLimitSubject,
        );
    });

    it('builds cache namespace SCAN patterns with exact historical format', () => {
        const keys = defaultBuilder();
        expect(keys.cacheNamespacePattern('tenant-settings')).toBe(EXPECTED.cachePattern);
    });

    it('exposes build for kind-specific keys', () => {
        const keys = defaultBuilder();
        expect(keys.build('cache', 'tenant-settings', 'abc')).toBe(EXPECTED.cache);
    });

    it('supports custom prefix and namespace', () => {
        const keys = createRedisKeyBuilder({
            prefix: 'custom-prefix',
            namespace: 'staging',
        });
        expect(keys.root).toBe('custom-prefix:staging:v1');
        expect(keys.cache('offers', 'sku-1')).toBe('custom-prefix:staging:v1:cache:offers:sku-1');
        expect(keys.lock('resource')).toBe('custom-prefix:staging:v1:lock:resource');
        expect(keys.cacheNamespacePattern('offers')).toBe('custom-prefix:staging:v1:cache:offers:*');
    });

    it('isolates tenants via distinct cache key parts under the same root', () => {
        const keys = defaultBuilder();
        const tenantA = keys.cache('tenant-settings', 'tenant-a');
        const tenantB = keys.cache('tenant-settings', 'tenant-b');
        expect(tenantA).toBe('wasl:local:v1:cache:tenant-settings:tenant-a');
        expect(tenantB).toBe('wasl:local:v1:cache:tenant-settings:tenant-b');
        expect(tenantA).not.toBe(tenantB);
    });

    it('rejects empty segments', () => {
        expect(() => createRedisKeyBuilder({ prefix: '', namespace: DEFAULT_NAMESPACE })).toThrow(
            'Redis key segment must not be empty',
        );
        expect(() => createRedisKeyBuilder({ prefix: DEFAULT_PREFIX, namespace: '' })).toThrow(
            'Redis key segment must not be empty',
        );
        const keys = defaultBuilder();
        expect(() => keys.cache('', 'abc')).toThrow('Redis key segment must not be empty');
        expect(() => keys.cache('tenant-settings', '')).toThrow('Redis key segment must not be empty');
        expect(() => keys.lock('')).toThrow('Redis key segment must not be empty');
    });

    it('rejects reserved characters in segments without rewriting them', () => {
        const keys = defaultBuilder();
        expect(() => keys.cache('bad*ns', 'abc')).toThrow(
            'Redis key segment contains a reserved character',
        );
        expect(() => keys.cache('tenant-settings', 'has space')).toThrow(
            'Redis key segment contains a reserved character',
        );
        expect(() => keys.lock('a:b')).toThrow('Redis key segment contains a reserved character');
        expect(() => createRedisKeyBuilder({ prefix: 'wasl:prod', namespace: 'local' })).toThrow(
            'Redis key segment contains a reserved character',
        );
    });
});

describe('RedisKeyBuilder compatibility wrapper', () => {
    it('delegates to the factory and preserves exact key outputs', () => {
        const viaFactory = createRedisKeyBuilder({
            prefix: DEFAULT_PREFIX,
            namespace: DEFAULT_NAMESPACE,
        });
        const viaWrapper = new RedisKeyBuilder(DEFAULT_PREFIX, DEFAULT_NAMESPACE);

        expect(viaWrapper.root).toBe(viaFactory.root);
        expect(viaWrapper.cache('tenant-settings', 'abc')).toBe(viaFactory.cache('tenant-settings', 'abc'));
        expect(viaWrapper.lock('order-fulfillment-tenant-1')).toBe(
            viaFactory.lock('order-fulfillment-tenant-1'),
        );
        expect(viaWrapper.rateLimit('compat-read', EXPECTED.rateLimitSubject)).toBe(
            viaFactory.rateLimit('compat-read', EXPECTED.rateLimitSubject),
        );
        expect(viaWrapper.cacheNamespacePattern('tenant-settings')).toBe(
            viaFactory.cacheNamespacePattern('tenant-settings'),
        );
        expect(viaWrapper.build('cache', 'tenant-settings', 'abc')).toBe(
            viaFactory.build('cache', 'tenant-settings', 'abc'),
        );
    });

    it('matches characterisation baselines for historical formats', () => {
        const keys = new RedisKeyBuilder(DEFAULT_PREFIX, DEFAULT_NAMESPACE);
        expect(keys.root).toBe(EXPECTED.root);
        expect(keys.cache('tenant-settings', 'abc')).toBe(EXPECTED.cache);
        expect(keys.lock('order-fulfillment-tenant-1')).toBe(EXPECTED.lock);
        expect(keys.rateLimit('compat-read', EXPECTED.rateLimitSubject)).toBe(
            `wasl:local:v1:ratelimit:compat-read:${EXPECTED.rateLimitEncoded}`,
        );
        expect(keys.cacheNamespacePattern('tenant-settings')).toBe(EXPECTED.cachePattern);
    });
});
