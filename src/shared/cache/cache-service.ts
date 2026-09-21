/**
 * Cache port.
 *
 * The cache is disposable by definition: every value must be reconstructible
 * from PostgreSQL. Nothing may treat a cache entry as a source of truth
 * (ADR-003).
 */
export interface CacheService {
  /** Returns `undefined` on a miss and on a deserialisation failure. */
  get<T>(namespace: string, key: string): Promise<T | undefined>;
  set<T>(namespace: string, key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
}

/**
 * Mutual exclusion across replicas.
 *
 * Locks coordinate work (they stop two workers doing the same job at the same
 * time); they are NOT a correctness mechanism. A lock can expire mid-operation
 * during a GC pause or network partition, so anything that must be correct
 * needs a database constraint or a conditional write as well.
 */
export interface LockHandle {
  readonly resource: string;
  /** Random token proving ownership; release is a no-op without a match. */
  readonly token: string;
  readonly expiresAt: number;
}

export interface DistributedLock {
  /** Returns `undefined` when the lock is already held. */
  acquire(resource: string, ttlSeconds: number): Promise<LockHandle | undefined>;
  /** Releases only if `handle.token` still owns the lock. */
  release(handle: LockHandle): Promise<boolean>;
  /** Acquires, runs `work`, and always releases. Returns `undefined` if not acquired. */
  withLock<T>(resource: string, ttlSeconds: number, work: () => Promise<T>): Promise<T | undefined>;
}
