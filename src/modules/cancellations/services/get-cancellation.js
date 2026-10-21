import { requireCancellationsRead } from './cancellation-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetCancellation(deps) {
/**
   * Loads one cancellation with lines after `cancellations.read` authorization.
   * @param {object} input tenantId, cancellationId, actorPermissions.
   * @returns {Promise<{cancellation: object}>}
   */
    async function execute(input) {
        requireCancellationsRead(deps.authorization, input.actorPermissions);
        const cancellation = await deps.cancellationQueryService.getCancellationById(input.tenantId, input.cancellationId);
        return { cancellation };
    }

    return { execute };
}
