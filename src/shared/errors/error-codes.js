/**
 * Central registry of machine-readable error codes.
 *
 * Codes are part of the public API contract: clients branch on them, so they
 * must stay stable. Never inline a string literal at a call site — reference
 * this registry instead.
 */
export const ErrorCode = {
    // Client input
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    MALFORMED_REQUEST: 'MALFORMED_REQUEST',
    PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
    UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
    // Identity and access
    AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
    // Resource state
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
    // Idempotency
    IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
    IDEMPOTENT_REQUEST_IN_PROGRESS: 'IDEMPOTENT_REQUEST_IN_PROGRESS',
    // Throttling
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    // Dependencies
    DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    EXTERNAL_SERVICE_TIMEOUT: 'EXTERNAL_SERVICE_TIMEOUT',
    CIRCUIT_OPEN: 'CIRCUIT_OPEN',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    // Startup / programming errors
    CONFIGURATION_INVALID: 'CONFIGURATION_INVALID',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};
/** Message returned to clients when the real reason must not be disclosed. */
export const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred';
