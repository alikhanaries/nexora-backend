import { NotFoundError } from '../../../shared/errors/index.js';
import { toProductDto } from './product-dto.js';
export class GetProduct {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'products.read');
        const product = await this.deps.products.findById(this.deps.database, input.tenantId, input.productId);
        if (product === null) {
            throw new NotFoundError('Product was not found');
        }
        return { product: toProductDto(product) };
    }
}
