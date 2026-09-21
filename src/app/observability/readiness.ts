import type { PostgresDatabase } from '../../infrastructure/postgres/postgres-database.js';
import type { RedisConnection } from '../../infrastructure/redis/redis-client.js';
import type { JobQueue } from '../../shared/queue/index.js';
import type { StorageProvider } from '../../shared/storage/index.js';

export interface ReadinessProbe {
  readonly name: string;
  check(): Promise<void>;
}

export interface ReadinessResult {
  readonly ready: boolean;
  readonly checks: Readonly<Record<string, 'ok' | 'failed'>>;
}

export class ReadinessService {
  private acceptingTraffic = true;

  constructor(private readonly probes: readonly ReadinessProbe[]) {}

  markNotReady(): void {
    this.acceptingTraffic = false;
  }

  async evaluate(): Promise<ReadinessResult> {
    if (!this.acceptingTraffic) {
      return { ready: false, checks: { process: 'failed' } };
    }

    const checks: Record<string, 'ok' | 'failed'> = {};
    let ready = true;

    for (const probe of this.probes) {
      try {
        await probe.check();
        checks[probe.name] = 'ok';
      } catch {
        checks[probe.name] = 'failed';
        ready = false;
      }
    }

    return { ready, checks };
  }
}

export function createDefaultProbes(deps: {
  readonly database: PostgresDatabase;
  readonly redis: RedisConnection;
  readonly queue: JobQueue;
  readonly storage: StorageProvider;
}): readonly ReadinessProbe[] {
  return [
    { name: 'postgres', check: () => deps.database.healthCheck() },
    { name: 'redis', check: () => deps.redis.healthCheck() },
    { name: 'queue', check: () => deps.queue.healthCheck() },
    { name: 'storage', check: () => deps.storage.healthCheck() },
  ];
}
