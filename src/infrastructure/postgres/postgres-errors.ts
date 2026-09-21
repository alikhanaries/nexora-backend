import { AppError, ConflictError, DatabaseError } from '../../shared/errors/index.js';

/** PostgreSQL SQLSTATE codes we translate into domain-meaningful errors. */
const SQLSTATE = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
  QUERY_CANCELED: '57014',
  LOCK_NOT_AVAILABLE: '55P03',
  INSUFFICIENT_PRIVILEGE: '42501',
} as const;

interface PostgresErrorShape {
  readonly code: string;
  readonly constraint: string | undefined;
}

/**
 * `pg` errors are plain objects at the type level, so narrow from `unknown`
 * instead of casting.
 */
function readPostgresError(error: unknown): PostgresErrorShape | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate: Record<string, unknown> = error as Record<string, unknown>;
  if (typeof candidate['code'] !== 'string') return undefined;

  return {
    code: candidate['code'],
    constraint: typeof candidate['constraint'] === 'string' ? candidate['constraint'] : undefined,
  };
}

/** True for failures that a caller may safely retry after a backoff. */
export function isRetryablePostgresError(error: unknown): boolean {
  const pgError = readPostgresError(error);
  if (pgError === undefined) return false;
  return (
    pgError.code === SQLSTATE.SERIALIZATION_FAILURE ||
    pgError.code === SQLSTATE.DEADLOCK_DETECTED ||
    pgError.code === SQLSTATE.LOCK_NOT_AVAILABLE
  );
}

/**
 * Translates a driver error into an AppError.
 *
 * Driver messages can contain SQL fragments and connection details, so nothing
 * from the original message is copied into the public error; only the
 * constraint name (a schema identifier, not user data) is surfaced.
 */
export function mapPostgresError(error: unknown, operation: string): AppError {
  if (AppError.isAppError(error)) return error;

  const pgError = readPostgresError(error);
  if (pgError === undefined) {
    return new DatabaseError('Database operation failed', error, { operation });
  }

  const details =
    pgError.constraint === undefined
      ? { operation }
      : { operation, constraint: pgError.constraint };

  switch (pgError.code) {
    case SQLSTATE.UNIQUE_VIOLATION:
      return new ConflictError('Resource already exists', details, error);
    case SQLSTATE.FOREIGN_KEY_VIOLATION:
      return new ConflictError('Referenced resource does not exist', details, error);
    case SQLSTATE.CHECK_VIOLATION:
    case SQLSTATE.EXCLUSION_VIOLATION:
      return new ConflictError('Resource violates a data integrity rule', details, error);
    case SQLSTATE.SERIALIZATION_FAILURE:
    case SQLSTATE.DEADLOCK_DETECTED:
      return new ConflictError('Concurrent modification, please retry', details, error);
    case SQLSTATE.QUERY_CANCELED:
      return new DatabaseError('Database query timed out', error, details);
    default:
      return new DatabaseError('Database operation failed', error, details);
  }
}
