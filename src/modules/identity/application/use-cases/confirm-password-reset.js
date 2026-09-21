import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { passwordResetConfirmRateLimitSubject } from '../../../../shared/auth/rate-limit-subject.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import { InvalidCredentialsError } from '../../domain/index.js';
import { hashSecret, validatePassword } from '../../../../shared/security/index.js';
export class ConfirmPasswordResetUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        if (this.deps.rateLimiter !== undefined) {
            const rateLimit = await this.deps.rateLimiter.consume({
                policy: AUTH_RATE_LIMIT_POLICIES.passwordResetConfirm,
                subject: passwordResetConfirmRateLimitSubject(input.token),
            });
            if (!rateLimit.allowed) {
                throw new RateLimitError(rateLimit.retryAfterSeconds);
            }
        }
        validatePassword(input.newPassword, this.deps.passwordPolicy);
        const tokenHash = hashSecret(input.token);
        const now = new Date();
        await this.deps.db.execute(async (tx) => {
            const token = await this.deps.resetTokens.findActiveByTokenHash(tx, tokenHash);
            if (token === null || token.expiresAt <= now) {
                throw new InvalidCredentialsError();
            }
            const passwordHash = await this.deps.passwordHasher.hash(input.newPassword);
            await this.deps.credentials.save(tx, token.userId, passwordHash);
            await this.deps.resetTokens.markUsed(tx, token.id, now);
            await this.deps.refreshSessions.revokeAllForUser(tx, token.userId, now);
        });
    }
}
