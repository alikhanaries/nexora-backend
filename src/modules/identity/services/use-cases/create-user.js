/**
 * Registers a user record and password credential within a tenant bootstrap flow.
 */
import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../../../shared/errors/index.js';
import { validatePassword } from '../../../../shared/security/index.js';
import { createUserEntity, parseEmail } from '../../models/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCreateUser(deps) {
    /** Registers user + password hash (tenant bootstrap / admin invite flows). */
    async function execute(input) {
        validatePassword(input.password, deps.passwordPolicy);
        const email = parseEmail(input.email);
        return deps.db.execute(async (tx) => {
            const existing = await deps.users.findByNormalizedEmail(tx, email.normalized);
            if (existing !== null) {
                throw new ConflictError('A user with this email already exists');
            }
            const user = createUserEntity(randomUUID(), email);
            const passwordHash = await deps.passwordHasher.hash(input.password);
            await deps.users.save(tx, user);
            await deps.credentials.save(tx, user.id, passwordHash);
            return {
                id: user.id,
                email: user.email.raw,
                status: user.status,
            };
        });
    }

    return { execute };
}
