import { getRequestContext } from '../context/request-context.js';
import { hashSecret } from '../security/index.js';

export function readRateLimitClientIp() {
    return getRequestContext()?.ip ?? 'unknown';
}

export function loginRateLimitSubject(tenantSlug) {
    return `${readRateLimitClientIp()}:${tenantSlug.trim().toLowerCase()}`;
}

export function refreshRateLimitSubject(refreshToken) {
    const tokenHash = hashSecret(refreshToken);
    return `${readRateLimitClientIp()}:${tokenHash.slice(0, 16)}`;
}

export function passwordResetRequestRateLimitSubject(email) {
    return `${readRateLimitClientIp()}:${email.trim().toLowerCase()}`;
}

export function passwordResetConfirmRateLimitSubject(token) {
    const tokenHash = hashSecret(token);
    return `${readRateLimitClientIp()}:${tokenHash.slice(0, 16)}`;
}
