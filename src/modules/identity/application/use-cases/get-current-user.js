import { AuthenticationError } from '../../../../shared/errors/index.js';
export class GetCurrentUserUseCase {
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
            const membership = await this.deps.memberships.findByTenantAndUser(tx, payload.tenantId, user.id);
            if (membership === null || !membership.grantsAccess()) {
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
}
