import { NotFoundError } from '../../../shared/errors/index.js';
import { toProductContentDto } from './product-dto.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetProductContent(deps) {
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'products.read');
        const product = await deps.products.findById(deps.database, input.tenantId, input.productId);
        if (product === null) {
            throw new NotFoundError('Product was not found');
        }
        if (input.locale !== undefined) {
            const entry = await deps.productContent.findByProductAndLocale(deps.database, input.tenantId, input.productId, input.locale);
            if (entry === null) {
                throw new NotFoundError('Product content was not found');
            }
            return { content: [toProductContentDto(entry)] };
        }
        const entries = await deps.productContent.listByProduct(deps.database, input.tenantId, input.productId);
        return { content: entries.map(toProductContentDto) };
    }
    return { execute };
}
