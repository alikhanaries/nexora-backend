import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { passwordResetConfirmRateLimitSubject } from '../../../../shared/auth/rate-limit-subject.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import { InvalidCredentialsError } from '../../models/index.js';
import { hashSecret, validatePassword } from '../../../../shared/security/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createConfirmPasswordReset(deps) {
    /** Validates token, sets new password, revokes other reset tokens. Rate-limited. */
    async function execute(input) {
        if (deps.rateLimiter !== undefined) {
            const rateLimit = await deps.rateLimiter.consume({
                policy: AUTH_RATE_LIMIT_POLICIES.passwordResetConfirm,
                subject: passwordResetConfirmRateLimitSubject(input.token),
            });
            if (!rateLimit.allowed) {
                throw new RateLimitError(rateLimit.retryAfterSeconds);
            }
        }
        validatePassword(input.newPassword, deps.passwordPolicy);
        const tokenHash = hashSecret(input.token);
        const now = new Date();
        await deps.db.execute(async (tx) => {
            const token = await deps.resetTokens.findActiveByTokenHash(tx, tokenHash);
            if (token === null || token.expiresAt <= now) {
                throw new InvalidCredentialsError();
            }
            const passwordHash = await deps.passwordHasher.hash(input.newPassword);
            await deps.credentials.save(tx, token.userId, passwordHash);
            await deps.resetTokens.markUsed(tx, token.id, now);
            await deps.refreshSessions.revokeAllForUser(tx, token.userId, now);
        });
    }

    return { execute };
}
