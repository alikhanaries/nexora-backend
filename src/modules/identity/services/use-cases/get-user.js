import { NotFoundError } from '../../../../shared/errors/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetUser(deps) {
    /** Loads user by id or NotFound (internal/admin use). */
    async function execute(userId) {
        return deps.db.execute(async (tx) => {
            const user = await deps.users.findById(tx, userId);
            if (user === null) {
                throw new NotFoundError('User was not found');
            }
            return user;
        });
    }

    return { execute };
}
