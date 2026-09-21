import { ErrorCode } from './error-codes.js';
export class AppError extends Error {
    code;
    httpStatus;
    safeDetails;
    isOperational;
    exposeMessage;
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
    static isAppError(value) {
        return value instanceof AppError;
    }
}
export class ValidationError extends AppError {
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
