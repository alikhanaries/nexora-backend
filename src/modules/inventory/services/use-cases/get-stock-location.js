import { NotFoundError } from '../../../../shared/errors/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetStockLocation(deps) {
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'inventory.read');
        const location = await deps.stockLocations.findById(deps.queryable, input.tenantId, input.stockLocationId);
        if (location === null) {
            throw new NotFoundError('Stock location was not found');
        }
        return { location };
    }
    return { execute };
}
