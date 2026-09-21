export { ErrorCode, GENERIC_ERROR_MESSAGE } from './error-codes.js';
export type { ErrorCodeValue } from './error-codes.js';
export {
  AppError,
  AuthenticationError,
  AuthorizationError,
  BusinessRuleError,
  CircuitOpenError,
  ConfigurationError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  ExternalServiceTimeoutError,
  IdempotencyConflictError,
  IdempotentRequestInProgressError,
  InternalError,
  MalformedRequestError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from './app-error.js';
export type { AppErrorOptions, SafeDetails } from './app-error.js';
export { describeErrorForLog, toErrorMessage } from './error-inspection.js';
