import {
    isRefreshSessionUsable,
    refreshSessionIndicatesFamilyReuse,
} from './refresh-session.js';

/**
 * Determines whether a presented refresh token may be rotated.
 *
 * A REPLACED or REVOKED token presented again indicates theft/replay within
 * the family and triggers full family revocation.
 * @param {import('./refresh-session.js').RefreshSession | null} session
 * @param {Date} [now]
 */
export function evaluateRefreshSession(session, now = new Date()) {
    if (session === null) {
        return { kind: 'invalid' };
    }
    if (refreshSessionIndicatesFamilyReuse(session)) {
        return { kind: 'family_reuse', session };
    }
    if (!isRefreshSessionUsable(session, now)) {
        return { kind: 'invalid' };
    }
    return { kind: 'valid', session };
}
