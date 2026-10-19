import { verify } from 'otplib';
import { auditRequestFields } from '../../../audit/public/index.js';
import { AuthenticationError, ValidationError } from '../../../../shared/errors/index.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
export class VerifyMfaUseCase {
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
        const factor = await this.deps.db.execute(async (tx) => this.deps.mfaFactors.findActiveByUser(tx, input.userId, input.tenantId), { tenantId: input.tenantId });
        if (factor === null) {
            throw new AuthenticationError('MFA is not enabled');
        }
        const secret = this.deps.secretEncryptor.decrypt(factor.secretEncrypted);
        const valid = await verify({ token: input.code, secret });
        if (!valid) {
            throw new ValidationError('Invalid MFA code');
        }
        await this.deps.stepUpService.recordStepUp({
            userId: input.userId,
            tenantId: input.tenantId,
            sessionId: input.sessionId,
        });
        await this.deps.db.execute(async (tx) => {
            await this.deps.auditRecorder?.record(tx, {
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
    }
}
