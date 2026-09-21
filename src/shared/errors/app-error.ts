import { ErrorCode, type ErrorCodeValue } from './error-codes.js';

export type SafeDetails = Readonly<Record<string, unknown>>;

export interface AppErrorOptions {
  readonly code: ErrorCodeValue;
  readonly message: string;
  readonly httpStatus: number;
  readonly safeDetails?: SafeDetails | undefined;
  readonly cause?: unknown;
  readonly isOperational?: boolean;
  readonly exposeMessage?: boolean;
}

export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly httpStatus: number;
  readonly safeDetails: SafeDetails | undefined;
  readonly isOperational: boolean;
  readonly exposeMessage: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.safeDetails = options.safeDetails;
    this.isOperational = options.isOperational ?? true;
    this.exposeMessage = options.exposeMessage ?? true;
    Error.captureStackTrace?.(this, new.target);
  }

  static isAppError(value: unknown): value is AppError {
    return value instanceof AppError;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', safeDetails?: SafeDetails, cause?: unknown) {
    super({
      code: ErrorCode.VALIDATION_FAILED,
      message,
      httpStatus: 400,
      safeDetails,
      cause,
    });
  }
}

export class MalformedRequestError extends AppError {
  constructor(message = 'Request could not be parsed', safeDetails?: SafeDetails, cause?: unknown) {
    super({
      code: ErrorCode.MALFORMED_REQUEST,
      message,
      httpStatus: 400,
      safeDetails,
      cause,
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication is required', safeDetails?: SafeDetails) {
    super({
      code: ErrorCode.AUTHENTICATION_REQUIRED,
      message,
      httpStatus: 401,
      safeDetails,
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Operation is not permitted', safeDetails?: SafeDetails) {
    super({
      code: ErrorCode.FORBIDDEN,
      message,
      httpStatus: 403,
      safeDetails,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource was not found', safeDetails?: SafeDetails) {
    super({
      code: ErrorCode.NOT_FOUND,
      message,
      httpStatus: 404,
      safeDetails,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource state conflict', safeDetails?: SafeDetails, cause?: unknown) {
    super({
      code: ErrorCode.CONFLICT,
      message,
      httpStatus: 409,
      safeDetails,
      cause,
    });
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, safeDetails?: SafeDetails) {
    super({
      code: ErrorCode.BUSINESS_RULE_VIOLATION,
      message,
      httpStatus: 422,
      safeDetails,
    });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, safeDetails?: SafeDetails) {
    super({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Rate limit exceeded',
      httpStatus: 429,
      safeDetails,
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database is unavailable', cause?: unknown, safeDetails?: SafeDetails) {
    super({
      code: ErrorCode.DATABASE_UNAVAILABLE,
      message,
      httpStatus: 503,
      safeDetails,
      cause,
      isOperational: false,
      exposeMessage: false,
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message = 'Upstream service call failed', cause?: unknown) {
    super({
      code: ErrorCode.EXTERNAL_SERVICE_ERROR,
      message,
      httpStatus: 502,
      safeDetails: { service },
      cause,
      isOperational: false,
      exposeMessage: false,
    });
  }
}

export class ExternalServiceTimeoutError extends AppError {
  constructor(operation: string, timeoutMs: number, cause?: unknown) {
    super({
      code: ErrorCode.EXTERNAL_SERVICE_TIMEOUT,
      message: 'Upstream service timed out',
      httpStatus: 504,
      safeDetails: { operation, timeoutMs },
      cause,
      isOperational: false,
      exposeMessage: false,
    });
  }
}

export class CircuitOpenError extends AppError {
  constructor(service: string) {
    super({
      code: ErrorCode.CIRCUIT_OPEN,
      message: 'Upstream service circuit is open',
      httpStatus: 503,
      safeDetails: { service },
      isOperational: false,
      exposeMessage: false,
    });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service is temporarily unavailable', safeDetails?: SafeDetails) {
    super({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message,
      httpStatus: 503,
      safeDetails,
      isOperational: false,
    });
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message = 'Idempotency key was reused with a different request') {
    super({
      code: ErrorCode.IDEMPOTENCY_CONFLICT,
      message,
      httpStatus: 409,
    });
  }
}

export class IdempotentRequestInProgressError extends AppError {
  constructor(message = 'An identical request is still being processed') {
    super({
      code: ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS,
      message,
      httpStatus: 409,
    });
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, safeDetails?: SafeDetails) {
    super({
      code: ErrorCode.CONFIGURATION_INVALID,
      message,
      httpStatus: 500,
      safeDetails,
      isOperational: false,
      exposeMessage: false,
    });
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal error', cause?: unknown) {
    super({
      code: ErrorCode.INTERNAL_ERROR,
      message,
      httpStatus: 500,
      cause,
      isOperational: false,
      exposeMessage: false,
    });
  }
}
