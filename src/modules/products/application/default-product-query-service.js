import { toProductDto } from './product-dto.js';

/**
 * @param {{ database: { withTenant?: (tenantId: string, work: (tx: object) => Promise<unknown>) => Promise<unknown> } }} deps
 * @param {string} tenantId
 * @param {object | undefined} tx
 * @param {(queryable: object) => Promise<unknown>} work
 */
async function withProductQueryable(deps, tenantId, tx, work) {
    if (tx !== undefined) {
        return work(tx);
    }
    if (deps.database?.withTenant !== undefined) {
        return deps.database.withTenant(tenantId, work);
    }
    return work(deps.database);
}

export class DefaultProductQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getProductById(tenantId, productId, tx) {
        return withProductQueryable(this.deps, tenantId, tx, async (queryable) => {
            const product = await this.deps.products.findById(queryable, tenantId, productId);
            return product === null ? null : toProductDto(product);
        });
    }
    async getProductBySku(tenantId, merchantSku, tx) {
        return withProductQueryable(this.deps, tenantId, tx, async (queryable) => {
            const product = await this.deps.products.findBySku(queryable, tenantId, merchantSku);
            return product === null ? null : toProductDto(product);
        });
    }
    async getProductsByIds(tenantId, productIds, tx) {
        if (productIds.length === 0) {
            return [];
        }
        return withProductQueryable(this.deps, tenantId, tx, async (queryable) => {
            const products = await this.deps.products.findByIds(queryable, tenantId, productIds);
            return products.map(toProductDto);
        });
    }
    async verifyProductBelongsToTenant(tenantId, productId, tx) {
        return withProductQueryable(this.deps, tenantId, tx, async (queryable) => {
            const product = await this.deps.products.findById(queryable, tenantId, productId);
            return product !== null;
        });
    }
}
