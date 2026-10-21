/**
 * Typed operational errors mapped to HTTP responses and stable {@link ErrorCode} values.
 *
 * Subclasses encode the common failure modes; handlers translate them without
 * leaking stack traces or internal details to clients.
 */
import { ErrorCode } from './error-codes.js';

/** Base class for domain and infrastructure failures exposed through the API. */
export class AppError extends Error {
    code;
    httpStatus;
    safeDetails;
    isOperational;
    exposeMessage;
    /** Builds an operational error with HTTP status, stable code, and optional safe client details. */
    constructor(options) {
        super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = new.target.name;
        this.code = options.code;
        this.httpStatus = options.httpStatus;
        this.safeDetails = options.safeDetails;
        this.isOperational = options.isOperational ?? true;
        this.exposeMessage = options.exposeMessage ?? true;
        Error.captureStackTrace?.(this, new.target);
    }
    /** Type guard for {@link AppError} instances. */
    static isAppError(value) {
        return value instanceof AppError;
    }
}
export class ValidationError extends AppError {
    /** HTTP 400 validation failure with optional field issues in `safeDetails`. */
    constructor(message = 'Request validation failed', safeDetails, cause) {
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
    /** HTTP 400 when the request body or syntax cannot be parsed. */
    constructor(message = 'Request could not be parsed', safeDetails, cause) {
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
    /** HTTP 401 when credentials are missing or invalid. */
    constructor(message = 'Authentication is required', safeDetails) {
        super({
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message,
            httpStatus: 401,
            safeDetails,
        });
    }
}
export class AuthorizationError extends AppError {
    /** HTTP 403 when the principal lacks permission for the operation. */
    constructor(message = 'Operation is not permitted', safeDetails) {
        super({
            code: ErrorCode.FORBIDDEN,
            message,
            httpStatus: 403,
            safeDetails,
        });
    }
}
export class NotFoundError extends AppError {
    /** HTTP 404 for missing resources. */
    constructor(message = 'Resource was not found', safeDetails) {
        super({
            code: ErrorCode.NOT_FOUND,
            message,
            httpStatus: 404,
            safeDetails,
        });
    }
}
export class ConflictError extends AppError {
    /** HTTP 409 for version/state conflicts (optimistic locking, duplicates). */
    constructor(message = 'Resource state conflict', safeDetails, cause) {
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
    /** HTTP 422 when input is valid but violates a domain rule. */
    constructor(message, safeDetails) {
        super({
            code: ErrorCode.BUSINESS_RULE_VIOLATION,
            message,
            httpStatus: 422,
            safeDetails,
        });
    }
}
export class RateLimitError extends AppError {
    retryAfterSeconds;
    /** HTTP 429 with `retryAfterSeconds` for rate-limit responses. */
    constructor(retryAfterSeconds, safeDetails) {
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
    /** HTTP 503 non-operational Postgres/driver failure (message hidden from clients). */
    constructor(message = 'Database is unavailable', cause, safeDetails) {
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
    /** HTTP 502 when an upstream HTTP/integration call fails. */
    constructor(service, message = 'Upstream service call failed', cause) {
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
    /** HTTP 504 when an upstream call exceeds its timeout budget. */
    constructor(operation, timeoutMs, cause) {
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
    /** HTTP 503 when the circuit breaker is open for a dependency. */
    constructor(service) {
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
    /** HTTP 503 for Redis, queue, storage, and other infra outages. */
    constructor(message = 'Service is temporarily unavailable', safeDetails) {
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
    /** HTTP 409 when the same idempotency key is reused with a different payload fingerprint. */
    constructor(message = 'Idempotency key was reused with a different request') {
        super({
            code: ErrorCode.IDEMPOTENCY_CONFLICT,
            message,
            httpStatus: 409,
        });
    }
}
export class IdempotentRequestInProgressError extends AppError {
    /** HTTP 409 while a matching idempotent request is still processing. */
    constructor(message = 'An identical request is still being processed') {
        super({
            code: ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS,
            message,
            httpStatus: 409,
        });
    }
}
export class ConfigurationError extends AppError {
    /** HTTP 500 boot-time or env misconfiguration (not exposed to API clients). */
    constructor(message, safeDetails) {
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
    /** HTTP 500 catch-all for unexpected failures. */
    constructor(message = 'Internal error', cause) {
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
