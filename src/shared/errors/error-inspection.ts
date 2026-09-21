import { AppError } from './app-error.js';

/** Extracts a message from an unknown thrown value without assuming its shape. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export interface LoggableError {
  readonly name: string;
  readonly message: string;
  readonly code?: string;
  readonly stack?: string;
  readonly cause?: LoggableError;
}

const MAX_CAUSE_DEPTH = 5;

/**
 * Normalises any thrown value into a structure safe for the log pipeline.
 *
 * Logs may keep stack traces (they never reach clients), but the cause chain is
 * depth-limited so a self-referencing `cause` cannot produce infinite output.
 */
export function describeErrorForLog(error: unknown, depth = 0): LoggableError {
  if (!(error instanceof Error)) {
    return { name: 'NonError', message: toErrorMessage(error) };
  }

  const described: LoggableError = {
    name: error.name,
    message: error.message,
    ...(AppError.isAppError(error) ? { code: error.code } : {}),
    ...(error.stack === undefined ? {} : { stack: error.stack }),
    ...(depth < MAX_CAUSE_DEPTH && error.cause !== undefined
      ? { cause: describeErrorForLog(error.cause, depth + 1) }
      : {}),
  };

  return described;
}
