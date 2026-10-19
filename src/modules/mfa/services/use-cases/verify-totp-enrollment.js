import { verify } from 'otplib';
import { AuthorizationError, NotFoundError, ValidationError, } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
export class VerifyTotpEnrollmentUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        if (!input.actorPermissions.includes('mfa.manage')) {
            throw new AuthorizationError('Missing required permission: mfa.manage');
        }
        const rateLimit = await this.deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.mfaVerify,
            subject: `${input.tenantId}:${input.userId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const factor = await this.deps.db.execute(async (tx) => this.deps.mfaFactors.findById(tx, input.factorId), { tenantId: input.tenantId });
        if (factor === null || factor.userId !== input.userId || factor.status !== 'PENDING') {
            throw new NotFoundError('MFA factor was not found');
        }
        const secret = this.deps.secretEncryptor.decrypt(factor.secretEncrypted);
        const valid = await verify({ token: input.code, secret });
        if (!valid) {
            throw new ValidationError('Invalid MFA code');
        }
        return { verified: true };
    }
}
