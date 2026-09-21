import { randomUUID } from 'node:crypto';
import type { DistributedLock, LockHandle } from '../../shared/cache/index.js';
import type { RedisConnection } from './redis-client.js';
import type { RedisKeyBuilder } from './redis-keys.js';

/**
 * Releases the lock only when the caller still owns it.
 *
 * An unconditional `DEL` is the classic distributed-lock bug: if holder A
 * stalls past the TTL, holder B acquires the lock, then A wakes up and deletes
 * B's lock. Compare-and-delete must be atomic, hence Lua.
 */
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

/**
 * Single-instance Redis lock.
 *
 * Scope, stated plainly: this coordinates work, it does not guarantee
 * correctness. A GC pause, a network partition or a Redis failover can leave
 * two holders believing they own the same resource. Anything that must not
 * happen twice needs a database constraint or a conditional write in addition
 * to the lock (ADR-003).
 */
export class RedisDistributedLock implements DistributedLock {
  constructor(
    private readonly connection: RedisConnection,
    private readonly keys: RedisKeyBuilder,
  ) {}

  async acquire(resource: string, ttlSeconds: number): Promise<LockHandle | undefined> {
    if (ttlSeconds <= 0) {
      throw new Error('Distributed locks must have a positive TTL');
    }

    // A lock without expiry deadlocks the system when its holder dies, so the
    // TTL is set in the same atomic SET as the ownership token.
    const token = randomUUID();
    const result = await this.connection.run('lock.acquire', () =>
      this.connection.client.set(this.keys.lock(resource), token, 'EX', ttlSeconds, 'NX'),
    );

    if (result !== 'OK') return undefined;

    return { resource, token, expiresAt: Date.now() + ttlSeconds * 1_000 };
  }

  async release(handle: LockHandle): Promise<boolean> {
    const released = await this.connection.run('lock.release', () =>
      this.connection.client.eval(RELEASE_SCRIPT, 1, this.keys.lock(handle.resource), handle.token),
    );
    return released === 1;
  }

  async withLock<T>(
    resource: string,
    ttlSeconds: number,
    work: () => Promise<T>,
  ): Promise<T | undefined> {
    const handle = await this.acquire(resource, ttlSeconds);
    if (handle === undefined) return undefined;

    try {
      return await work();
    } finally {
      await this.release(handle);
    }
  }
}
