import { auditRequestFields } from '../../../audit/public/index.js';
import { hashSecret } from '../../../../shared/security/index.js';
import { evaluateRefreshSession, InvalidCredentialsError, RefreshSession, } from '../../domain/index.js';
import { createRefreshSessionDraft } from '../auth-tokens.js';
export class RefreshTokenUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        const tokenHash = hashSecret(input.refreshToken);
        const now = new Date();
        const existing = await this.deps.db.execute(async (tx) => this.deps.refreshSessions.findByTokenHash(tx, tokenHash));
        const outcome = evaluateRefreshSession(existing, now);
        if (outcome.kind === 'invalid') {
            throw new InvalidCredentialsError();
        }
        if (outcome.kind === 'family_reuse') {
            await this.deps.db.execute(async (tx) => {
                await this.deps.refreshSessions.revokeFamily(tx, outcome.session.familyId, now);
                await this.deps.auditRecorder?.record(tx, {
                    tenantId: outcome.session.tenantId,
                    actorKind: 'user',
                    actorId: outcome.session.userId,
                    eventType: 'REFRESH_REUSE_DETECTED',
                    resourceType: 'refresh_session',
                    resourceId: outcome.session.id,
                    ...auditRequestFields(),
                });
            }, { tenantId: outcome.session.tenantId });
            throw new InvalidCredentialsError();
        }
        const current = outcome.session;
        return this.deps.db.execute(async (tx) => {
            const { refreshToken, session: newDraft } = createRefreshSessionDraft({
                userId: current.userId,
                tenantId: current.tenantId,
                familyId: current.familyId,
            }, this.deps.refreshTokenTtlSeconds);
            const newSession = RefreshSession.create(newDraft);
            await this.deps.refreshSessions.save(tx, newSession);
            await this.deps.refreshSessions.markReplaced(tx, current.id, newSession.id, now);
            const accessToken = await this.deps.accessTokenService.sign({
                sub: current.userId,
                tenantId: current.tenantId,
                sessionId: newSession.id,
                tokenVersion: 1,
            });
            return {
                accessToken,
                refreshToken,
                expiresIn: this.deps.accessTokenTtlSeconds,
            };
        }, { tenantId: current.tenantId });
    }
}
