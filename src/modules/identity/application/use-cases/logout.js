import { hashSecret } from '../../../../shared/security/index.js';
import { InvalidCredentialsError } from '../../domain/index.js';
export class LogoutUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        const tokenHash = hashSecret(input.refreshToken);
        const now = new Date();
        await this.deps.db.execute(async (tx) => {
            const session = await this.deps.refreshSessions.findByTokenHash(tx, tokenHash);
            if (session === null || session.status !== 'ACTIVE') {
                throw new InvalidCredentialsError();
            }
            await this.deps.refreshSessions.revokeById(tx, session.id, now);
        });
    }
}
