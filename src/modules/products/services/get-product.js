import { NotFoundError } from '../../../shared/errors/index.js';
import { toProductDto } from './product-dto.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetProduct(deps) {
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'products.read');
        const product = await deps.products.findById(deps.database, input.tenantId, input.productId);
        if (product === null) {
            throw new NotFoundError('Product was not found');
        }
        return { product: toProductDto(product) };
    }
    return { execute };
}
