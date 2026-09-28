import { NotFoundError } from '../../../shared/errors/index.js';
import {
    mapStockConnectCeChannelProductCollection,
    mapStockConnectCeChannelProductItem,
} from './mappers/stockconnect-ce-channel-product.mapper.js';

const DEFAULT_PAGE_SIZE = 250;
const MAX_PAGE_SIZE = 250;

/**
 * StockConnect `GET channels/{channelId}/products` compatibility query.
 */
export class StockConnectCeChannelProductsQuery {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../authorization/public/index.js').DefaultAuthorizationService} deps.authorization
     * @param {import('../../channels/public/channel-query-service.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
     * @param {import('../../products/public/product-query-service.js').DefaultProductQueryService} deps.productQueryService
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {readonly string[]} input.actorPermissions
     * @param {number} input.ceChannelId
     * @param {number} [input.page]
     * @param {number} [input.pageSize]
     */
    async listChannelProducts(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'offers.read');
        this.deps.authorization.requirePermission(input.actorPermissions, 'products.read');

        const page = input.page ?? 1;
        const pageSize = Math.min(input.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

        let channel;
        try {
            channel = await this.deps.channelQueryService.getChannelByExternalReference(
                input.tenantId,
                String(input.ceChannelId),
            );
        }
        catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            throw error;
        }

        const offers = await this.deps.offerQueryService.listActiveOffersByChannel(
            input.tenantId,
            channel.id,
        );

        const content = [];
        for (const offer of offers) {
            const product = await this.deps.productQueryService.getProductById(input.tenantId, offer.productId);
            if (product === null) {
                continue;
            }
            content.push(mapStockConnectCeChannelProductItem(product, offer));
        }

        const totalCount = content.length;
        const start = (page - 1) * pageSize;
        const pageItems = content.slice(start, start + pageSize);
        return mapStockConnectCeChannelProductCollection(pageItems, totalCount, pageSize);
    }
}
