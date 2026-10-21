/**
 * CE v2 catalog mutations (product/offer upserts) against core catalog commands.
 */
import { resolveChannelStockLocationId } from '../../commerce-integrations/public/index.js';
import { getCurrencyMinorUnitExponent } from '../../../shared/money/index.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';

const DEFAULT_CURRENCY = 'SAR';
const DEFAULT_CONTENT_LOCALE = 'en';

/**
 * Compat v2 catalog/offer façade for public `/api/v2/ce/*` routes.
 * Mutates platform commerce via existing use cases/services (additive; no adapter rewrite).
 */
export class CompatV2CatalogCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../products/public/product-query-service.js').DefaultProductQueryService} deps.productQueryService
     * @param {{ execute: Function }} deps.createProduct
     * @param {{ execute: Function }} [deps.archiveProduct]
     * @param {{ execute: Function }} [deps.deactivateProduct]
     * @param {{ execute: Function }} [deps.upsertProductContent]
     * @param {{ execute: Function }} [deps.getProductContent]
     * @param {{ execute: Function }} [deps.suspendOffer]
     * @param {{ execute: Function }} [deps.activateOffer]
     * @param {import('../../commerce-integrations/public/commerce-integration-query-service.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
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
     * CE POST /products/freeze — FREEZE suspends offers; UNFREEZE reactivates suspended offers.
     * @param {object} input
     */
    async freezeProducts(input) {
        const items = Array.isArray(input.body) ? input.body : [];
        const results = [];
        for (const item of items) {
            const merchantSku = String(item.MerchantProductNo ?? '').trim();
            const action = String(item.Action ?? '').trim().toUpperCase();
            if (!merchantSku) {
                throw new ValidationError('MerchantProductNo is required');
            }
            if (action !== 'FREEZE' && action !== 'UNFREEZE') {
                throw new ValidationError('Action must be FREEZE or UNFREEZE');
            }
            const product = await this.deps.productQueryService.getProductBySku(input.tenantId, merchantSku);
            if (product === null) {
                throw new ValidationError(`Unknown MerchantProductNo: ${merchantSku}`);
            }
            const offers = await this.deps.offerQueryService.getOffersByProduct(input.tenantId, product.id);
            let mutated = 0;
            if (action === 'FREEZE') {
                for (const offer of offers) {
                    if (offer.status === 'ACTIVE') {
                        await this.requireUseCase('suspendOffer').execute({
                            tenantId: input.tenantId,
                            actorId: input.actorId,
                            actorKind: input.actorKind,
                            actorPermissions: input.actorPermissions,
                            offerId: offer.id,
                        });
                        mutated += 1;
                    }
                }
                if (mutated === 0 && product.status === 'ACTIVE' && this.deps.deactivateProduct !== undefined) {
                    await this.deps.deactivateProduct.execute({
                        tenantId: input.tenantId,
                        actorId: input.actorId,
                        actorKind: input.actorKind,
                        actorPermissions: input.actorPermissions,
                        productId: product.id,
                    });
                    mutated = 1;
                }
            }
            else {
                for (const offer of offers) {
                    if (offer.status === 'SUSPENDED') {
                        await this.requireUseCase('activateOffer').execute({
                            tenantId: input.tenantId,
                            actorId: input.actorId,
                            actorKind: input.actorKind,
                            actorPermissions: input.actorPermissions,
                            offerId: offer.id,
                        });
                        mutated += 1;
                    }
                }
            }
            results.push({
                MerchantProductNo: merchantSku,
                Action: action,
                Reason: item.Reason ?? null,
                MutatedCount: mutated,
            });
        }
        return { Success: true, StatusCode: 200, Message: null, Content: results };
    }

    /**
     * CE POST /products/bulkdelete — archive by MerchantProductNo.
     * @param {object} input
     */
    async bulkDeleteProducts(input) {
        const skus = Array.isArray(input.body) ? input.body : [];
        const results = [];
        for (const raw of skus) {
            const merchantSku = String(raw ?? '').trim();
            if (!merchantSku) {
                throw new ValidationError('MerchantProductNo is required');
            }
            const product = await this.deps.productQueryService.getProductBySku(input.tenantId, merchantSku);
            if (product === null) {
                results.push({ MerchantProductNo: merchantSku, Deleted: false, Reason: 'NOT_FOUND' });
                continue;
            }
            if (product.status === 'ARCHIVED') {
                results.push({ MerchantProductNo: merchantSku, Deleted: true, Reason: 'ALREADY_ARCHIVED' });
                continue;
            }
            await this.requireUseCase('archiveProduct').execute({
                tenantId: input.tenantId,
                actorId: input.actorId,
                actorKind: input.actorKind,
                actorPermissions: input.actorPermissions,
                productId: product.id,
            });
            results.push({ MerchantProductNo: merchantSku, Deleted: true });
        }
        return { Success: true, StatusCode: 200, Message: null, Content: results };
    }

    /**
     * CE PATCH /products/extra-data/bulk — merge ExtraData keys into product content attributes;
     * price-like keys also upsert channel prices when a matching channel exists.
     * @param {object} input
     */
    async patchExtraData(input) {
        const items = Array.isArray(input.body) ? input.body : [];
        const channels = await this.deps.commerceIntegrationQueryService.listCommerceIntegrations(input.tenantId, {});
        const results = [];
        for (const item of items) {
            const merchantSku = String(item.MerchantProductNo ?? '').trim();
            if (!merchantSku) {
                throw new ValidationError('MerchantProductNo is required');
            }
            const product = await this.deps.productQueryService.getProductBySku(input.tenantId, merchantSku);
            if (product === null) {
                throw new ValidationError(`Unknown MerchantProductNo: ${merchantSku}`);
            }
            const operations = Array.isArray(item.Operations) ? item.Operations : [];
            const attributePatch = {};
            for (const op of operations) {
                const key = String(op.Key ?? op.key ?? '').trim();
                if (!key) {
                    continue;
                }
                const opName = String(op.Op ?? op.op ?? 'replace').toLowerCase();
                if (opName === 'remove') {
                    attributePatch[key] = null;
                    continue;
                }
                attributePatch[key] = op.Value ?? op.value ?? null;
                await this.applyPriceLikeExtraData({
                    input,
                    product,
                    channels,
                    key,
                    value: op.Value ?? op.value,
                });
            }
            if (Object.keys(attributePatch).length > 0) {
                await this.mergeProductAttributes(input, product.id, attributePatch);
            }
            results.push({ MerchantProductNo: merchantSku, Applied: Object.keys(attributePatch).length });
        }
        return { Success: true, StatusCode: 200, Message: null, Content: results };
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
        const channels = await this.deps.commerceIntegrationQueryService.listCommerceIntegrations(input.tenantId, {});
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
                await this.upsertChannelPrice(input, product.id, channel.id, currency, amountMinor);
            }
        }
        return { Success: true, StatusCode: 200, Message: null };
    }

    /**
     * Finds first configured stock location across tenant integrations for CE catalog stock writes.
     * @param {string} tenantId Tenant scope.
     * @returns {Promise<string>} Stock location id.
     * @throws {ValidationError} When no channel exposes defaultStockLocationId.
     */
    async resolveDefaultStockLocationId(tenantId) {
        const channels = await this.deps.commerceIntegrationQueryService.listCommerceIntegrations(tenantId, {});
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

    /**
     * @param {string} name
     */
    requireUseCase(name) {
        const useCase = this.deps[name];
        if (useCase === undefined || typeof useCase.execute !== 'function') {
            throw new ValidationError(`Compat v2 catalog requires ${name}`);
        }
        return useCase;
    }

    /**
     * Loads existing product content (if any), merges attribute patch, upserts locale `en` content.
     * Side effect: product content write per call; no idempotency wrapper at this helper level.
     * @param {object} input Actor + tenant from CE catalog mutation context.
     * @param {string} productId Internal product id.
     * @param {Record<string, unknown>} attributePatch Extra-data keys to merge (null removes key).
     */
    async mergeProductAttributes(input, productId, attributePatch) {
        const upsert = this.requireUseCase('upsertProductContent');
        const getContent = this.deps.getProductContent;
        let existingAttributes = {};
        let title = null;
        let description = null;
        let brand = null;
        if (getContent !== undefined) {
            try {
                const { content } = await getContent.execute({
                    tenantId: input.tenantId,
                    actorId: input.actorId,
                    actorKind: input.actorKind,
                    actorPermissions: input.actorPermissions,
                    productId,
                    locale: DEFAULT_CONTENT_LOCALE,
                });
                const entry = content?.[0];
                if (entry !== undefined) {
                    existingAttributes = { ...(entry.attributes ?? {}) };
                    title = entry.title ?? null;
                    description = entry.description ?? null;
                    brand = entry.brand ?? null;
                }
            }
            catch (error) {
                if (!(error instanceof NotFoundError)) {
                    throw error;
                }
            }
        }
        const nextAttributes = { ...existingAttributes };
        for (const [key, value] of Object.entries(attributePatch)) {
            if (value === null) {
                delete nextAttributes[key];
            }
            else {
                nextAttributes[key] = value;
            }
        }
        await upsert.execute({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            productId,
            locale: DEFAULT_CONTENT_LOCALE,
            title,
            description,
            brand,
            attributes: nextAttributes,
        });
    }

    /**
     * When extra-data key looks like a price field, upserts channel prices for matched integrations.
     * Matches channel by name/code/reference substring; falls back to all tenant channels.
     * @param {object} params input context, product entity, channel list, attribute key/value.
     */
    async applyPriceLikeExtraData({ input, product, channels, key, value }) {
        const lower = key.toLowerCase();
        if (!lower.endsWith('price') && lower !== 'price') {
            return;
        }
        const priceDecimal = Number(value);
        if (!Number.isFinite(priceDecimal) || priceDecimal < 0) {
            return;
        }
        const currency = DEFAULT_CURRENCY;
        const amountMinor = Math.round(priceDecimal * (10 ** getCurrencyMinorUnitExponent(currency)));
        const needle = lower.replace(/price$/i, '').replace(/[_-]/g, '');
        const matched = channels.filter((channel) => {
            const hay = `${channel.name ?? ''} ${channel.code ?? ''} ${channel.externalReference ?? ''}`.toLowerCase();
            if (needle.length === 0) {
                return true;
            }
            return hay.includes(needle);
        });
        const targets = matched.length > 0 ? matched : channels;
        for (const channel of targets) {
            await this.upsertChannelPrice(input, product.id, channel.id, currency, amountMinor);
        }
    }

    /**
     * Creates or updates effective price for product/channel/currency (minor units).
     * @param {object} input CE catalog mutation actor context.
     * @param {string} productId Product id.
     * @param {string} channelId Commerce integration id.
     * @param {string} currency ISO currency code.
     * @param {number} amountMinor Price in minor units.
     */
    async upsertChannelPrice(input, productId, channelId, currency, amountMinor) {
        const existing = await this.deps.pricingService.getEffectivePrice(
            input.tenantId,
            productId,
            channelId,
            currency,
        );
        if (existing === null) {
            await this.deps.pricingService.createPrice({
                tenantId: input.tenantId,
                productId,
                channelId,
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
