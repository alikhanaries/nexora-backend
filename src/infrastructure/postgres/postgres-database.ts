import { performance } from 'node:perf_hooks';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import type { DatabaseConfig } from '../../shared/config/index.js';
import { ConfigurationError, DatabaseError } from '../../shared/errors/index.js';
import type { Logger } from '../../shared/logging/index.js';
import { migrateUp } from './migrator.js';
import type { MetricsRecorder } from '../../shared/metrics/index.js';
import type {
  IsolationLevel,
  QueryOptions,
  QueryResult,
  QueryRow,
  Queryable,
  Transaction,
  TransactionManager,
  TransactionOptions,
} from '../../shared/persistence/index.js';
import { mapPostgresError } from './postgres-errors.js';

/**
 * Custom GUC read by row-level-security policies. Set with `set_config(..., true)`
 * so PostgreSQL discards it at COMMIT or ROLLBACK.
 */
export const TENANT_SETTING = 'app.tenant_id';

const TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whitelist: isolation level cannot be parameterised, so it must not be free text. */
const ISOLATION_SQL: Record<IsolationLevel, string> = {
  'read committed': 'READ COMMITTED',
  'repeatable read': 'REPEATABLE READ',
  serializable: 'SERIALIZABLE',
};

const UNLABELLED_OPERATION = 'unlabelled';

function toQueryResult(rows: readonly QueryRow[], rowCount: number | null): QueryResult {
  return { rows, rowCount: rowCount ?? rows.length };
}

/** Wraps a checked-out client so callers can only run queries, never manage it. */
class PostgresTransaction implements Transaction {
  constructor(
    private readonly client: PoolClient,
    readonly tenantId: string | null,
    private readonly metrics: MetricsRecorder,
  ) {}

  async query(
    sql: string,
    parameters: readonly unknown[] = [],
    options?: QueryOptions,
  ): Promise<QueryResult> {
    return runQuery(this.client, sql, parameters, options, this.metrics);
  }
}

async function runQuery(
  client: Pick<PoolClient, 'query'>,
  sql: string,
  parameters: readonly unknown[],
  options: QueryOptions | undefined,
  metrics: MetricsRecorder,
): Promise<QueryResult> {
  const operation = options?.operation ?? UNLABELLED_OPERATION;
  const startedAt = performance.now();
  let success = false;

  try {
    const result = await client.query<QueryRow>(sql, [...parameters]);
    success = true;
    return toQueryResult(result.rows, result.rowCount);
  } catch (error) {
    throw mapPostgresError(error, operation);
  } finally {
    metrics.recordDbQuery({
      operation,
      durationSeconds: (performance.now() - startedAt) / 1_000,
      success,
    });
  }
}

export interface PostgresDatabaseDependencies {
  readonly config: DatabaseConfig;
  readonly logger: Logger;
  readonly metrics: MetricsRecorder;
}

/**
 * Owns the single connection pool for the process.
 *
 * One pool per process, never one connection per request: connections are a
 * scarce server-side resource and PostgreSQL degrades badly past a few hundred
 * backends.
 */
export class PostgresDatabase implements Queryable, TransactionManager {
  private readonly pool: Pool;
  private readonly logger: Logger;
  private readonly metrics: MetricsRecorder;
  private closed = false;

  constructor({ config, logger, metrics }: PostgresDatabaseDependencies) {
    this.logger = logger.child({ component: 'postgres' });
    this.metrics = metrics;

    const poolConfig: PoolConfig = {
      connectionString: config.url,
      max: config.pool.max,
      min: config.pool.min,
      connectionTimeoutMillis: config.pool.connectionTimeoutMs,
      idleTimeoutMillis: config.pool.idleTimeoutMs,
      // Server-side cap: stops a pathological query from pinning a backend.
      statement_timeout: config.pool.statementTimeoutMs,
      // Client-side cap: releases the pool slot even if the server never answers.
      query_timeout: config.pool.queryTimeoutMs,
      application_name: 'nexora-backend',
      ...(config.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    };

    this.pool = new Pool(poolConfig);

    // An idle client can fail without any query in flight. Without this
    // listener the error becomes an unhandled 'error' event and kills Node.
    this.pool.on('error', (error: Error) => {
      this.logger.error({ err: { name: error.name, message: error.message } }, 'Idle client error');
    });
  }

  async query(
    sql: string,
    parameters: readonly unknown[] = [],
    options?: QueryOptions,
  ): Promise<QueryResult> {
    this.assertOpen();
    return runQuery(this.pool, sql, parameters, options, this.metrics);
  }

  async execute<T>(
    work: (tx: Transaction) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    this.assertOpen();

    const tenantId = normaliseTenantId(options.tenantId);
    const client = await this.connect();

    try {
      await client.query(buildBeginStatement(options));

      if (tenantId !== null) {
        // `SET LOCAL` does not accept bind parameters; set_config(..., true)
        // is the parameterised, transaction-local equivalent.
        await client.query('SELECT set_config($1, $2, true)', [TENANT_SETTING, tenantId]);
      }

      const result = await work(new PostgresTransaction(client, tenantId, this.metrics));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await this.rollbackQuietly(client);
      throw mapPostgresError(error, 'transaction');
    } finally {
      // Returning the client resets SET LOCAL state along with the transaction.
      client.release();
    }
  }

  /** Cheap round-trip used by the readiness probe. */
  async healthCheck(): Promise<void> {
    await this.query('SELECT 1', [], { operation: 'health.ping' });
  }

  /** Publishes pool saturation so `db_pool_connections` reflects reality. */
  reportPoolMetrics(): void {
    this.metrics.setDbPoolConnections({
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    });
  }

  async runMigrations(): Promise<void> {
    await migrateUp(this.pool, this.logger);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.pool.end();
    this.logger.info({}, 'PostgreSQL pool closed');
  }

  private async connect(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      throw new DatabaseError('Could not acquire a database connection', error);
    }
  }

  private async rollbackQuietly(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // The connection is usually already broken here; the original error is
      // the one worth propagating, so this is logged and swallowed.
      this.logger.warn(
        { err: { message: rollbackError instanceof Error ? rollbackError.message : 'unknown' } },
        'ROLLBACK failed',
      );
    }
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new DatabaseError('Database pool is closed');
    }
  }
}

function buildBeginStatement(options: TransactionOptions): string {
  const parts = ['BEGIN'];
  if (options.isolationLevel !== undefined) {
    parts.push(`ISOLATION LEVEL ${ISOLATION_SQL[options.isolationLevel]}`);
  }
  if (options.readOnly === true) {
    parts.push('READ ONLY');
  }
  return parts.join(' ');
}

/**
 * Rejects anything that is not a UUID.
 *
 * The value reaches `set_config` as a bind parameter so injection is not the
 * risk; the risk is a malformed tenant silently matching no RLS policy and
 * producing an empty result set that looks like "no data".
 */
function normaliseTenantId(tenantId: string | null | undefined): string | null {
  if (tenantId === undefined || tenantId === null) return null;
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new ConfigurationError('Tenant identifier must be a UUID');
  }
  return tenantId;
}
