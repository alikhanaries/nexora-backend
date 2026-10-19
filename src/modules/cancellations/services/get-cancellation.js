import { requireCancellationsRead } from './cancellation-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetCancellation(deps) {
    async function execute(input) {
        requireCancellationsRead(deps.authorization, input.actorPermissions);
        const cancellation = await deps.cancellationQueryService.getCancellationById(input.tenantId, input.cancellationId);
        return { cancellation };
    }

    return { execute };
}
