/**
 * Resolves the authenticated user, active session, and membership for `/auth/me`-style routes.
 */
import { AuthenticationError } from '../../../../shared/errors/index.js';
import { canAuthenticate, isRefreshSessionExpired, membershipGrantsAccess } from '../../models/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetCurrentUser(deps) {
    /** Resolves user, tenant membership, and permissions from access token. */
    async function execute(input) {
        let payload;
        try {
            payload = await deps.accessTokenService.verify(input.accessToken);
        }
        catch {
            throw new AuthenticationError();
        }
        return deps.db.execute(async (tx) => {
            const session = await deps.refreshSessions.findById(tx, payload.sessionId);
            if (session === null || session.status !== 'ACTIVE' || isRefreshSessionExpired(session)) {
                throw new AuthenticationError();
            }
            const user = await deps.users.findById(tx, payload.sub);
            if (user === null || !canAuthenticate(user)) {
                throw new AuthenticationError();
            }
            const membership = await deps.memberships.findByTenantAndUser(tx, payload.tenantId, user.id);
            if (membership === null || !membershipGrantsAccess(membership)) {
                throw new AuthenticationError();
            }
            return {
                id: user.id,
                email: user.email.raw,
                status: user.status,
                tenantId: payload.tenantId,
                membershipStatus: membership.status,
            };
        }, { tenantId: payload.tenantId });
    }

    return { execute };
}
