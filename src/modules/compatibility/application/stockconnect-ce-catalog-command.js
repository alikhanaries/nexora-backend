import { resolveChannelStockLocationId } from '../../channels/public/index.js';
import { getCurrencyMinorUnitExponent } from '../../../shared/money/index.js';
import { ValidationError } from '../../../shared/errors/index.js';

const DEFAULT_CURRENCY = 'SAR';

/**
 * StockConnect CE Merchant catalog/offer façade.
 * Mutates Nexora commerce via existing use cases/services (additive; no adapter rewrite).
 */
export class StockConnectCeCatalogCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../products/public/product-query-service.js').DefaultProductQueryService} deps.productQueryService
     * @param {{ execute: Function }} deps.createProduct
     * @param {import('../../channels/public/channel-query-service.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../../inventory/public/inventory-service.js').DefaultInventoryService} deps.inventoryService
     * @param {import('../../pricing/public/pricing-service.js').DefaultPricingService} deps.pricingService
     * @param {import('../../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * CE POST /products — upsert by MerchantProductNo.
     * @param {object} input
     */
    async pushProducts(input) {
        const items = Array.isArray(input.body) ? input.body : [];
        const results = [];
        for (const item of items) {
            const merchantSku = String(item.MerchantProductNo ?? item.merchantProductNo ?? '').trim();
            if (!merchantSku) {
                throw new ValidationError('MerchantProductNo is required');
            }
            let product = await this.deps.productQueryService.getProductBySku(input.tenantId, merchantSku);
            if (product === null) {
                const created = await this.deps.createProduct.execute({
                    tenantId: input.tenantId,
                    actorId: input.actorId,
                    actorKind: input.actorKind,
                    actorPermissions: input.actorPermissions,
                    merchantSku,
                });
                product = created.product;
            }
            results.push({ MerchantProductNo: merchantSku, ProductId: product.id });
        }
        return {
            Success: true,
            StatusCode: 200,
            Message: null,
            Content: results,
        };
    }

    /**
     * CE PUT /offer/stock
     * @param {object} input
     */
    async updateOfferStock(input) {
        const items = Array.isArray(input.body) ? input.body : [];
        const stockLocationId = await this.resolveDefaultStockLocationId(input.tenantId);
        for (const item of items) {
            const merchantSku = String(item.MerchantProductNo ?? '').trim();
            if (!merchantSku) {
                throw new ValidationError('MerchantProductNo is required');
            }
            const product = await this.deps.productQueryService.getProductBySku(input.tenantId, merchantSku);
            if (product === null) {
                throw new ValidationError(`Unknown MerchantProductNo: ${merchantSku}`);
            }
            const targetStock = Number(item.StockLocations?.[0]?.Stock ?? item.Stock ?? 0);
            if (!Number.isFinite(targetStock) || targetStock < 0) {
                throw new ValidationError('Stock must be a non-negative number');
            }
            const availability = await this.deps.inventoryService.getAvailability(
                input.tenantId,
                product.id,
                stockLocationId,
            );
            const currentOnHand = availability.totals.onHand;
            const delta = targetStock - currentOnHand;
            if (delta !== 0) {
                await this.deps.inventoryService.adjust({
                    tenantId: input.tenantId,
                    stockLocationId,
                    productId: product.id,
                    delta,
                    referenceType: 'CE_OFFER_STOCK',
                    referenceId: `${merchantSku}:${targetStock}`,
                });
            }
        }
        return { Success: true, StatusCode: 200, Message: null };
    }

    /**
     * CE PUT /offer (price)
     * @param {object} input
     */
    async updateOfferPrice(input) {
        const items = Array.isArray(input.body) ? input.body : [];
        const channels = await this.deps.channelQueryService.listChannels(input.tenantId, {});
        for (const item of items) {
            const merchantSku = String(item.MerchantProductNo ?? '').trim();
            if (!merchantSku) {
                throw new ValidationError('MerchantProductNo is required');
            }
            const product = await this.deps.productQueryService.getProductBySku(input.tenantId, merchantSku);
            if (product === null) {
                throw new ValidationError(`Unknown MerchantProductNo: ${merchantSku}`);
            }
            const currency = String(item.CurrencyCode ?? item.currency ?? DEFAULT_CURRENCY).toUpperCase();
            const priceDecimal = Number(item.Price ?? item.price);
            if (!Number.isFinite(priceDecimal) || priceDecimal < 0) {
                throw new ValidationError('Price must be a non-negative number');
            }
            const exponent = getCurrencyMinorUnitExponent(currency);
            const amountMinor = Math.round(priceDecimal * (10 ** exponent));
            for (const channel of channels) {
                const existing = await this.deps.pricingService.getEffectivePrice(
                    input.tenantId,
                    product.id,
                    channel.id,
                    currency,
                );
                if (existing === null) {
                    await this.deps.pricingService.createPrice({
                        tenantId: input.tenantId,
                        productId: product.id,
                        channelId: channel.id,
                        currency,
                        amountMinor,
                    });
                }
                else if (existing.amountMinor !== amountMinor) {
                    await this.deps.pricingService.updatePrice({
                        tenantId: input.tenantId,
                        priceId: existing.id,
                        amountMinor,
                    });
                }
            }
        }
        return { Success: true, StatusCode: 200, Message: null };
    }

    async resolveDefaultStockLocationId(tenantId) {
        const channels = await this.deps.channelQueryService.listChannels(tenantId, {});
        for (const channel of channels) {
            try {
                const stockLocationId = resolveChannelStockLocationId(channel);
                if (stockLocationId !== null) {
                    return stockLocationId;
                }
            }
            catch {
                // try next channel
            }
        }
        throw new ValidationError(
            'No channel stock location configured; set defaultStockLocationId on a channel',
        );
    }
}
