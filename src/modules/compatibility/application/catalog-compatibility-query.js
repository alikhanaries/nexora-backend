import { NotFoundError } from '../../../shared/errors/index.js';
import { mapProductToCeCatalogItem } from './mappers/compatibility-catalog-product.mapper.js';

export class CatalogCompatibilityQuery {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../products/public/product-query-service.js').DefaultProductQueryService} deps.productQueryService
     * @param {import('../../products/application/get-product-content.js').GetProduct} deps.getProductContent
     * @param {import('../../authorization/public/index.js').DefaultAuthorizationService} deps.authorization
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
            let content = null;
            try {
                const result = await this.deps.getProductContent.execute({
                    tenantId: input.tenantId,
                    actorPermissions: input.actorPermissions,
                    productId: product.id,
                    locale: 'en',
                });
                content = result.content[0] ?? null;
            }
            catch (error) {
                if (!(error instanceof NotFoundError)) {
                    throw error;
                }
            }
            items.push(mapProductToCeCatalogItem(product, content));
        }
        return {
            Success: true,
            Message: null,
            ValidationErrors: {},
            Content: items,
        };
    }
}
