import { mapProductToCeCatalogItem } from './mappers/compatibility-catalog-product.mapper.js';

/**
 * StockConnect GET products by SKU — avoids requiring product content rows (seed/catalog parity).
 */
export class StockConnectCeProductsQuery {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../authorization/public/index.js').DefaultAuthorizationService} deps.authorization
     * @param {import('../../products/public/product-query-service.js').DefaultProductQueryService} deps.productQueryService
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {readonly string[]} input.actorPermissions
     * @param {string[]} input.merchantProductNos
     */
    async listProductsByMerchantProductNos(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'products.read');
        const items = [];
        for (const raw of input.merchantProductNos) {
            const merchantSku = raw.trim();
            if (merchantSku.length === 0) {
                continue;
            }
            const product = await this.deps.productQueryService.getProductBySku(input.tenantId, merchantSku);
            if (product === null) {
                continue;
            }
            items.push(mapProductToCeCatalogItem(product, null));
        }
        return {
            Success: true,
            Message: null,
            ValidationErrors: {},
            Content: items,
        };
    }
}
