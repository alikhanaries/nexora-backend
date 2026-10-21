import { auditRequestFields } from '../../../audit/public/index.js';
import {
    canAuthenticate,
    createRefreshSessionEntity,
    InvalidCredentialsError,
    membershipGrantsAccess,
    parseEmail,
} from '../../models/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { loginRateLimitSubject } from '../../../../shared/auth/rate-limit-subject.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import { normalizeTenantSlug, validateTenantSlug } from '../../../../shared/security/index.js';
import { createRefreshSessionDraft } from '../auth-tokens.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createLogin(deps) {
    async function recordFailure(tenantId, tx) {
        const event = {
            tenantId: tenantId ?? null,
            actorKind: 'system',
            eventType: 'LOGIN_FAILURE',
            ...auditRequestFields(),
        };
        if (tx !== undefined) {
            await deps.auditRecorder?.record(tx, event);
            return;
        }
        if (tenantId !== undefined) {
            await deps.db.execute(async (innerTx) => {
                await deps.auditRecorder?.record(innerTx, event);
            }, { tenantId });
        }
    }

    async function execute(input) {
        validateTenantSlug(input.tenantSlug);
        const tenantSlug = normalizeTenantSlug(input.tenantSlug);
        if (deps.rateLimiter !== undefined) {
            const rateLimit = await deps.rateLimiter.consume({
                policy: AUTH_RATE_LIMIT_POLICIES.login,
                subject: loginRateLimitSubject(tenantSlug),
            });
            if (!rateLimit.allowed) {
                throw new RateLimitError(rateLimit.retryAfterSeconds);
            }
        }
        let email;
        try {
            email = parseEmail(input.email);
        }
        catch {
            await recordFailure(undefined);
            throw new InvalidCredentialsError();
        }
        const authContext = await deps.db.execute(async (tx) => {
            const tenant = await deps.tenants.findBySlug(tx, tenantSlug);
            if (tenant === null || tenant.status !== 'ACTIVE') {
                await recordFailure(undefined, tx);
                throw new InvalidCredentialsError();
            }
            const user = await deps.users.findByNormalizedEmail(tx, email.normalized);
            if (user === null || !canAuthenticate(user)) {
                throw new InvalidCredentialsError();
            }
            const passwordHash = await deps.credentials.findHashByUserId(tx, user.id);
            if (passwordHash === null) {
                throw new InvalidCredentialsError();
            }
            const passwordValid = await deps.passwordHasher.verify(input.password, passwordHash);
            if (!passwordValid) {
                throw new InvalidCredentialsError();
            }
            return { tenant, user };
        });
        return deps.db.execute(async (tx) => {
            const membership = await deps.memberships.findByTenantAndUser(tx, authContext.tenant.id, authContext.user.id);
            if (membership === null || !membershipGrantsAccess(membership)) {
                throw new InvalidCredentialsError();
            }
            const { refreshToken, session: sessionDraft } = createRefreshSessionDraft({ userId: authContext.user.id, tenantId: authContext.tenant.id }, deps.refreshTokenTtlSeconds);
            const session = createRefreshSessionEntity(sessionDraft);
            await deps.refreshSessions.save(tx, session);
            const accessToken = await deps.accessTokenService.sign({
                sub: authContext.user.id,
                tenantId: authContext.tenant.id,
                sessionId: session.id,
                tokenVersion: 1,
            });
            await deps.auditRecorder?.record(tx, {
                tenantId: authContext.tenant.id,
                actorKind: 'user',
                actorId: authContext.user.id,
                eventType: 'LOGIN_SUCCESS',
                resourceType: 'user',
                resourceId: authContext.user.id,
                ...auditRequestFields(),
            });
            return {
                accessToken,
                refreshToken,
                expiresIn: deps.accessTokenTtlSeconds,
            };
        }, { tenantId: authContext.tenant.id });
    }

    return { execute };
}
