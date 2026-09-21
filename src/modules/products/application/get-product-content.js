import { NotFoundError } from '../../../shared/errors/index.js';
import { toProductContentDto } from './product-dto.js';
export class GetProductContent {
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
        if (input.locale !== undefined) {
            const entry = await this.deps.productContent.findByProductAndLocale(this.deps.database, input.tenantId, input.productId, input.locale);
            if (entry === null) {
                throw new NotFoundError('Product content was not found');
            }
            return { content: [toProductContentDto(entry)] };
        }
        const entries = await this.deps.productContent.listByProduct(this.deps.database, input.tenantId, input.productId);
        return { content: entries.map(toProductContentDto) };
    }
}
