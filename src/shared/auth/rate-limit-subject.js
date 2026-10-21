import { getRequestContext } from '../context/request-context.js';
import { hashSecret } from '../security/index.js';

/** Client IP from request context, or `unknown` outside HTTP scope. */
export function readRateLimitClientIp() {
    return getRequestContext()?.ip ?? 'unknown';
}

/** Rate-limit bucket key for login attempts: IP plus normalized tenant slug. */
export function loginRateLimitSubject(tenantSlug) {
    return `${readRateLimitClientIp()}:${tenantSlug.trim().toLowerCase()}`;
}

/** Rate-limit bucket key for token refresh: IP plus hashed refresh token prefix. */
export function refreshRateLimitSubject(refreshToken) {
    const tokenHash = hashSecret(refreshToken);
    return `${readRateLimitClientIp()}:${tokenHash.slice(0, 16)}`;
}

/** Rate-limit bucket key for password reset requests: IP plus normalized email. */
export function passwordResetRequestRateLimitSubject(email) {
    return `${readRateLimitClientIp()}:${email.trim().toLowerCase()}`;
}

/** Rate-limit bucket key for password reset confirmation: IP plus hashed token prefix. */
export function passwordResetConfirmRateLimitSubject(token) {
    const tokenHash = hashSecret(token);
    return `${readRateLimitClientIp()}:${tokenHash.slice(0, 16)}`;
}
