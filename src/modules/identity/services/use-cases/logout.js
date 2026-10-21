/**
 * Revokes the refresh session backing the presented refresh token (idempotent logout).
 */
import { hashSecret } from '../../../../shared/security/index.js';
import { InvalidCredentialsError } from '../../models/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createLogout(deps) {
    /** Revokes refresh token session family; safe to call twice. */
    async function execute(input) {
        const tokenHash = hashSecret(input.refreshToken);
        const now = new Date();
        await deps.db.executeAsOwner(async (tx) => {
            const session = await deps.refreshSessions.findByTokenHash(tx, tokenHash);
            if (session === null || session.status !== 'ACTIVE') {
                throw new InvalidCredentialsError();
            }
            await deps.refreshSessions.revokeById(tx, session.id, now);
        });
    }

    return { execute };
}
