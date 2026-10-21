import { auditRequestFields } from '../../../audit/public/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { refreshRateLimitSubject } from '../../../../shared/auth/rate-limit-subject.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import { hashSecret } from '../../../../shared/security/index.js';
import {
    createRefreshSessionEntity,
    evaluateRefreshSession,
    InvalidCredentialsError,
} from '../../models/index.js';
import { createRefreshSessionDraft } from '../auth-tokens.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createRefreshToken(deps) {
    async function execute(input) {
        if (deps.rateLimiter !== undefined) {
            const rateLimit = await deps.rateLimiter.consume({
                policy: AUTH_RATE_LIMIT_POLICIES.refresh,
                subject: refreshRateLimitSubject(input.refreshToken),
            });
            if (!rateLimit.allowed) {
                throw new RateLimitError(rateLimit.retryAfterSeconds);
            }
        }
        const tokenHash = hashSecret(input.refreshToken);
        const now = new Date();
        const existing = await deps.db.executeAsOwner(async (tx) => deps.refreshSessions.findByTokenHash(tx, tokenHash));
        const outcome = evaluateRefreshSession(existing, now);
        if (outcome.kind === 'invalid') {
            throw new InvalidCredentialsError();
        }
        if (outcome.kind === 'family_reuse') {
            await deps.db.execute(async (tx) => {
                await deps.refreshSessions.revokeFamily(tx, outcome.session.familyId, now);
                await deps.auditRecorder?.record(tx, {
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
        return deps.db.execute(async (tx) => {
            const { refreshToken, session: newDraft } = createRefreshSessionDraft({
                userId: current.userId,
                tenantId: current.tenantId,
                familyId: current.familyId,
            }, deps.refreshTokenTtlSeconds);
            const newSession = createRefreshSessionEntity(newDraft);
            await deps.refreshSessions.save(tx, newSession);
            await deps.refreshSessions.markReplaced(tx, current.id, newSession.id, now);
            const accessToken = await deps.accessTokenService.sign({
                sub: current.userId,
                tenantId: current.tenantId,
                sessionId: newSession.id,
                tokenVersion: 1,
            });
            return {
                accessToken,
                refreshToken,
                expiresIn: deps.accessTokenTtlSeconds,
            };
        }, { tenantId: current.tenantId });
    }

    return { execute };
}
