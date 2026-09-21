import { auditRequestFields } from '../../../audit/public/index.js';
import { ValidationError } from '../../../../shared/errors/index.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { hashSecret } from '../../../../shared/security/index.js';
export class UseRecoveryCodeUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        const rateLimit = await this.deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.mfaVerify,
            subject: `${input.tenantId}:${input.userId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const codeHash = hashSecret(input.code.trim());
        const now = new Date();
        await this.deps.db.execute(async (tx) => {
            const record = await this.deps.recoveryCodes.findActiveByHash(tx, codeHash);
            if (record === null ||
                record.userId !== input.userId ||
                record.tenantId !== input.tenantId) {
                throw new ValidationError('Invalid recovery code');
            }
            await this.deps.recoveryCodes.markUsed(tx, record.id, now);
            await this.deps.auditRecorder?.record(tx, {
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
        await this.deps.stepUpService.recordStepUp({
            userId: input.userId,
            tenantId: input.tenantId,
            sessionId: input.sessionId,
        });
        return { stepUpVerified: true };
    }
}
