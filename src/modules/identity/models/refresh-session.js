/**
 * @typedef {{
 *   id: string,
 *   userId: string,
 *   tenantId: string,
 *   tokenHash: string,
 *   familyId: string,
 *   status: string,
 *   expiresAt: Date,
 *   createdAt: Date,
 *   lastUsedAt: Date | null,
 *   revokedAt: Date | null,
 *   replacedBy: string | null,
 * }} RefreshSession
 */

/**
 * @param {RefreshSession} props
 * @returns {RefreshSession}
 */
export function createRefreshSessionEntity(props) {
    return {
        id: props.id,
        userId: props.userId,
        tenantId: props.tenantId,
        tokenHash: props.tokenHash,
        familyId: props.familyId,
        status: props.status,
        expiresAt: props.expiresAt,
        createdAt: props.createdAt,
        lastUsedAt: props.lastUsedAt,
        revokedAt: props.revokedAt,
        replacedBy: props.replacedBy,
    };
}

/**
 * @param {RefreshSession} session
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isRefreshSessionExpired(session, now = new Date()) {
    return now >= session.expiresAt;
}

/**
 * @param {RefreshSession} session
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isRefreshSessionUsable(session, now = new Date()) {
    return session.status === 'ACTIVE' && !isRefreshSessionExpired(session, now);
}

/**
 * @param {RefreshSession} session
 * @returns {boolean}
 */
export function refreshSessionIndicatesFamilyReuse(session) {
    return session.status === 'REPLACED' || session.status === 'REVOKED';
}
