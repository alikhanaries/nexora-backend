import { AuthenticationError } from '../../../shared/errors/index.js';
export class AuthenticateAccessTokenUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        let payload;
        try {
            payload = await this.deps.accessTokenService.verify(input.accessToken);
        }
        catch {
            throw new AuthenticationError();
        }
        return this.deps.db.execute(async (tx) => {
            const session = await this.deps.refreshSessions.findById(tx, payload.sessionId);
            if (session === null || session.status !== 'ACTIVE' || session.isExpired()) {
                throw new AuthenticationError();
            }
            const user = await this.deps.users.findById(tx, payload.sub);
            if (user === null || !user.canAuthenticate()) {
                throw new AuthenticationError();
            }
            const permissions = await this.deps.membershipPermissions.resolvePermissions(tx, {
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
}
