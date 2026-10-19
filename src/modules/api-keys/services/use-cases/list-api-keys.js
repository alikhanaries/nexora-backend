import { AuthorizationError } from '../../../../shared/errors/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createListApiKeys(deps) {
    /**
     * @param {object} input
     */
    async function execute(input) {
        if (!input.actorPermissions.includes('api_keys.read')) {
            throw new AuthorizationError('Missing required permission: api_keys.read');
        }
        return deps.db.execute(async (tx) => deps.apiKeys.listByTenant(tx, input.tenantId), {
            tenantId: input.tenantId,
        });
    }

    return { execute };
}

/** @deprecated Prefer {@link createListApiKeys}; kept for existing import sites. */
export class ListApiKeysUseCase {
    constructor(deps) {
        return createListApiKeys(deps);
    }
}
