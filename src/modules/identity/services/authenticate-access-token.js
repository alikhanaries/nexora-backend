import { AuthenticationError } from '../../../shared/errors/index.js';
import { canAuthenticate, isRefreshSessionExpired } from '../models/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createAuthenticateAccessToken(deps) {
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
            const permissions = await deps.membershipPermissions.resolvePermissions(tx, {
                userId: user.id,
                tenantId: payload.tenantId,
            });
            if (permissions.length === 0) {
                throw new AuthenticationError();
            }
            return {
                kind: 'user',
                id: user.id,
                tenantId: payload.tenantId,
                permissions,
                authenticationMethod: input.authenticationMethod,
                sessionId: payload.sessionId,
                email: user.email.raw,
            };
        }, { tenantId: payload.tenantId });
    }

    return { execute };
}
