import { auditRequestFields } from '../../../audit/public/index.js';
import { ValidationError } from '../../../../shared/errors/index.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { hashSecret } from '../../../../shared/security/index.js';
/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createUseRecoveryCode(deps) {
    return {
        async execute(input) {
            const rateLimit = await deps.rateLimiter.consume({
                policy: AUTH_RATE_LIMIT_POLICIES.mfaVerify,
                subject: `${input.tenantId}:${input.userId}`,
            });
            if (!rateLimit.allowed) {
                throw new RateLimitError(rateLimit.retryAfterSeconds);
            }
            const codeHash = hashSecret(input.code.trim());
            const now = new Date();
            await deps.db.execute(async (tx) => {
                const record = await deps.recoveryCodes.findActiveByHash(tx, codeHash);
                if (record === null ||
                    record.userId !== input.userId ||
                    record.tenantId !== input.tenantId) {
                    throw new ValidationError('Invalid recovery code');
                }
                await deps.recoveryCodes.markUsed(tx, record.id, now);
                await deps.auditRecorder?.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: 'user',
                    actorId: input.userId,
                    eventType: 'MFA_STEP_UP',
                    resourceType: 'recovery_code',
                    resourceId: record.id,
                    metadata: { method: 'recovery_code' },
                    ...auditRequestFields(),
                });
            }, { tenantId: input.tenantId });
            await deps.stepUpService.recordStepUp({
                userId: input.userId,
                tenantId: input.tenantId,
                sessionId: input.sessionId,
            });
            return { stepUpVerified: true };
        },
    };
}
