import { verify } from 'otplib';
import { auditRequestFields } from '../../../audit/public/index.js';
import { AuthenticationError, ValidationError } from '../../../../shared/errors/index.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createVerifyMfa(deps) {
    return {
        /** Validates TOTP and records step-up session. Rate-limited per user/tenant. */
        async execute(input) {
            const rateLimit = await deps.rateLimiter.consume({
                policy: AUTH_RATE_LIMIT_POLICIES.mfaVerify,
                subject: `${input.tenantId}:${input.userId}`,
            });
            if (!rateLimit.allowed) {
                throw new RateLimitError(rateLimit.retryAfterSeconds);
            }
            const factor = await deps.db.execute(async (tx) => deps.mfaFactors.findActiveByUser(tx, input.userId, input.tenantId), { tenantId: input.tenantId });
            if (factor === null) {
                throw new AuthenticationError('MFA is not enabled');
            }
            const secret = deps.secretEncryptor.decrypt(factor.secretEncrypted);
            const valid = await verify({ token: input.code, secret });
            if (!valid) {
                throw new ValidationError('Invalid MFA code');
            }
            await deps.stepUpService.recordStepUp({
                userId: input.userId,
                tenantId: input.tenantId,
                sessionId: input.sessionId,
            });
            await deps.db.execute(async (tx) => {
                await deps.auditRecorder?.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: 'user',
                    actorId: input.userId,
                    eventType: 'MFA_STEP_UP',
                    resourceType: 'mfa_factor',
                    resourceId: factor.id,
                    ...auditRequestFields(),
                });
            }, { tenantId: input.tenantId });
            return { stepUpVerified: true };
        },
    };
}
