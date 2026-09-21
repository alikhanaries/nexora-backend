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
export {};
