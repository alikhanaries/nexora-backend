/**
 * Persistence ports.
 *
 * Application code composes work with `TransactionManager.execute`; it never
 * acquires, releases or otherwise manages a connection. Repositories
 * (infrastructure) accept a `Transaction` and own the SQL.
 *
 * `execute` returns untyped rows on purpose: crossing this boundary requires
 * explicit narrowing (see shared/validation), which keeps `any` out of the
 * codebase.
 */

export type QueryRow = Readonly<Record<string, unknown>>;

export interface QueryResult {
  readonly rows: readonly QueryRow[];
  readonly rowCount: number;
}

export interface QueryOptions {
  /**
   * Short, stable name used as the `operation` metric label, e.g.
   * `outbox.claim_batch`. Must be low cardinality: never interpolate an id.
   */
  readonly operation?: string | undefined;
}

export interface Queryable {
  query(sql: string, parameters?: readonly unknown[], options?: QueryOptions): Promise<QueryResult>;
}

export interface Transaction extends Queryable {
  /**
   * Tenant bound to this transaction via `SET LOCAL app.tenant_id`.
   * Null means no tenant scope was requested.
   */
  readonly tenantId: string | null;
}

export type IsolationLevel = 'read committed' | 'repeatable read' | 'serializable';

export interface TransactionOptions {
  /**
   * Sets the transaction-local tenant for row-level security.
   *
   * It must be transaction-local: a session-level setting would survive on a
   * pooled connection and leak into the next, unrelated transaction.
   */
  readonly tenantId?: string | null | undefined;
  readonly isolationLevel?: IsolationLevel | undefined;
  readonly readOnly?: boolean | undefined;
}

export interface TransactionManager {
  /**
   * Runs `work` inside BEGIN/COMMIT. Any thrown error triggers ROLLBACK and is
   * rethrown unchanged, so callers see the original failure.
   */
  execute<T>(work: (tx: Transaction) => Promise<T>, options?: TransactionOptions): Promise<T>;
}
