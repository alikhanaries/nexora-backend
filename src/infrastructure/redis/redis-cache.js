/**
 * Redis-backed cache.
 *
 * Deliberately small: `get`, `set`, `delete`. A cache is only safe while it
 * stays obviously disposable, and every extra feature (tag invalidation,
 * stampede protection, tiered stores) adds a way for it to diverge from
 * PostgreSQL. Add them when a measured problem demands it.
 */
export class RedisCache {
    connection;
    keys;
    logger;
    constructor(connection, keys, logger) {
        this.connection = connection;
        this.keys = keys;
        this.logger = logger.child({ component: 'cache' });
    }
    async get(namespace, key) {
        const raw = await this.connection.run('cache.get', () => this.connection.client.get(this.keys.cache(namespace, key)));
        if (raw === null)
            return undefined;
        try {
            return JSON.parse(raw);
        }
        catch {
            // A poisoned entry must behave as a miss, not as an outage: the caller
            // can always rebuild the value from PostgreSQL.
            this.logger.warn({ namespace }, 'Discarding unparseable cache entry');
            await this.delete(namespace, key);
            return undefined;
        }
    }
    async set(namespace, key, value, ttlSeconds) {
        if (ttlSeconds <= 0) {
            throw new Error('Cache entries must have a positive TTL');
        }
        const serialised = JSON.stringify(value);
        await this.connection.run('cache.set', () => this.connection.client.set(this.keys.cache(namespace, key), serialised, 'EX', ttlSeconds));
    }
    async delete(namespace, key) {
        await this.connection.run('cache.delete', () => this.connection.client.del(this.keys.cache(namespace, key)));
    }
}
