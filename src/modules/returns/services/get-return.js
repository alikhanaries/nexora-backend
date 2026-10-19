import { requireReturnsRead } from './return-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetReturn(deps) {
    async function execute(input) {
        requireReturnsRead(deps.authorization, input.actorPermissions);
        const returnDetail = await deps.returnQueryService.getReturnById(input.tenantId, input.returnId);
        return { return: returnDetail };
    }

    return { execute };
}
