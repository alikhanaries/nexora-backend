import { toProductDto } from './product-dto.js';
export class DefaultProductQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getProductById(tenantId, productId, tx) {
        const queryable = tx ?? this.deps.database;
        const product = await this.deps.products.findById(queryable, tenantId, productId);
        return product === null ? null : toProductDto(product);
    }
    async getProductBySku(tenantId, merchantSku, tx) {
        const queryable = tx ?? this.deps.database;
        const product = await this.deps.products.findBySku(queryable, tenantId, merchantSku);
        return product === null ? null : toProductDto(product);
    }
    async getProductsByIds(tenantId, productIds, tx) {
        if (productIds.length === 0)
            return [];
        const queryable = tx ?? this.deps.database;
        const products = await this.deps.products.findByIds(queryable, tenantId, productIds);
        return products.map(toProductDto);
    }
    async verifyProductBelongsToTenant(tenantId, productId, tx) {
        const queryable = tx ?? this.deps.database;
        const product = await this.deps.products.findById(queryable, tenantId, productId);
        return product !== null;
    }
}
