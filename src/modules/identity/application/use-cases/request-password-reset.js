import { randomUUID } from 'node:crypto';
import { generateSecureToken, hashSecret } from '../../../../shared/security/index.js';
import { Email } from '../../domain/index.js';
const RESET_TOKEN_TTL_SECONDS = 3_600;
/** Always completes silently to avoid email enumeration. */
export class RequestPasswordResetUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        let email;
        try {
            email = Email.create(input.email);
        }
        catch {
            return;
        }
        await this.deps.db.execute(async (tx) => {
            const user = await this.deps.users.findByNormalizedEmail(tx, email.normalized);
            if (user === null) {
                return;
            }
            await this.deps.resetTokens.revokeActiveForUser(tx, user.id);
            const resetToken = generateSecureToken(32);
            const tokenHash = hashSecret(resetToken);
            const now = new Date();
            const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_SECONDS * 1_000);
            await this.deps.resetTokens.save(tx, {
                id: randomUUID(),
                userId: user.id,
                tokenHash,
                status: 'ACTIVE',
                expiresAt,
                createdAt: now,
                usedAt: null,
            });
            await this.deps.notifier.notifyPasswordReset({
                userId: user.id,
                email: user.email.raw,
                resetToken,
            });
        });
    }
}
