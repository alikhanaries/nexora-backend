/**
 * Determines whether a presented refresh token may be rotated.
 *
 * A REPLACED or REVOKED token presented again indicates theft/replay within
 * the family and triggers full family revocation.
 */
export function evaluateRefreshSession(session, now = new Date()) {
    if (session === null) {
        return { kind: 'invalid' };
    }
    if (session.indicatesFamilyReuse()) {
        return { kind: 'family_reuse', session };
    }
    if (!session.isUsable(now)) {
        return { kind: 'invalid' };
    }
    return { kind: 'valid', session };
}
