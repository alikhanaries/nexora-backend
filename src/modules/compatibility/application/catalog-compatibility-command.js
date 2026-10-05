import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { readCompatibilityAvailableQuantity } from './read-compatibility-available-quantity.js';
import {
    resolveCompatibilityChannel,
    resolveCompatibilityStockLocationId,
} from './resolve-compatibility-channel.js';
import {
    buildCeMutationEnvelope,
    mapCeProductItemToUpsertCommands,
    mergeCeExtraDataAttributes,
} from './mappers/compatibility-catalog-product.mapper.js';
import { mapCeOfferPriceRequest, mapCeOfferStockLine } from './mappers/compatibility-catalog-offer.mapper.js';

const ROUTE_POST_PRODUCTS = 'POST /api/v2/products';
const ROUTE_POST_PRODUCTS_FREEZE = 'POST /api/v2/products/freeze';
const ROUTE_POST_PRODUCTS_BULKDELETE = 'POST /api/v2/products/bulkdelete';
const ROUTE_PATCH_EXTRA_DATA = 'PATCH /api/v2/products/extra-data/bulk';
const ROUTE_PUT_OFFER = 'PUT /api/v2/offer';
const ROUTE_PUT_OFFER_STOCK = 'PUT /api/v2/offer/stock';

export class CatalogCompatibilityCommand {
    deps;

    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     */
    async upsertProducts(input) {
        return this.runIdempotent(input, ROUTE_POST_PRODUCTS, JSON.stringify(input.body), async () => {
            this.deps.authorization.requirePermission(input.actorPermissions, 'products.create');
            const items = normalizeProductBatch(input.body);
            const results = [];
            const validationErrors = {};
            for (const item of items) {
                try {
                    const mapped = mapCeProductItemToUpsertCommands(item);
                    const product = await this.ensureProductRecord(input, mapped);
                    results.push({
                        MerchantProductNo: product.merchantSku,
                        Success: true,
                    });
                }
                catch (error) {
                    const sku = item.MerchantProductNo?.trim() ?? 'unknown';
                    validationErrors[sku] = [error instanceof Error ? error.message : 'Processing failed'];
                    results.push({
                        MerchantProductNo: sku,
                        Success: false,
                    });
                }
            }
            const success = Object.keys(validationErrors).length === 0;
            return buildCeMutationEnvelope(success, results, success ? undefined : validationErrors);
        });
    }

    async freezeProducts(input) {
        return this.runIdempotent(input, ROUTE_POST_PRODUCTS_FREEZE, JSON.stringify(input.body), async () => {
            this.deps.authorization.requirePermission(input.actorPermissions, 'products.update');
            const skus = normalizeMerchantProductNoList(input.body);
            const channel = await this.tryResolveChannel(input);
            const results = [];
            const validationErrors = {};
            for (const merchantSku of skus) {
                try {
                    const product = await this.requireProduct(input.tenantId, merchantSku);
                    if (channel !== null) {
                        const offer = await this.deps.offerQueryService.getOfferForProductAndChannel(
                            input.tenantId,
                            product.id,
                            channel.id,
                        );
                        if (offer !== null && offer.status === 'ACTIVE') {
                            await this.deps.suspendOffer.execute({
                                tenantId: input.tenantId,
                                actorId: input.actorId,
                                actorKind: input.actorKind,
                                actorPermissions: input.actorPermissions,
                                offerId: offer.id,
                            });
                        }
                    }
                    else if (product.status === 'ACTIVE') {
                        await this.deps.deactivateProduct.execute({
                            tenantId: input.tenantId,
                            actorId: input.actorId,
                            actorKind: input.actorKind,
                            actorPermissions: input.actorPermissions,
                            productId: product.id,
                        });
                    }
                    results.push({ MerchantProductNo: merchantSku, Success: true });
                }
                catch (error) {
                    validationErrors[merchantSku] = [error instanceof Error ? error.message : 'Freeze failed'];
                    results.push({ MerchantProductNo: merchantSku, Success: false });
                }
            }
            const success = Object.keys(validationErrors).length === 0;
            return buildCeMutationEnvelope(success, results, success ? undefined : validationErrors);
        });
    }

    async bulkDeleteProducts(input) {
        return this.runIdempotent(input, ROUTE_POST_PRODUCTS_BULKDELETE, JSON.stringify(input.body), async () => {
            this.deps.authorization.requirePermission(input.actorPermissions, 'products.update');
            const skus = normalizeMerchantProductNoList(input.body);
            const results = [];
            const validationErrors = {};
            for (const merchantSku of skus) {
                try {
                    const product = await this.requireProduct(input.tenantId, merchantSku);
                    if (product.status !== 'INACTIVE' && product.status !== 'ARCHIVED') {
                        await this.deps.deactivateProduct.execute({
                            tenantId: input.tenantId,
                            actorId: input.actorId,
                            actorKind: input.actorKind,
                            actorPermissions: input.actorPermissions,
                            productId: product.id,
                        });
                    }
                    results.push({ MerchantProductNo: merchantSku, Success: true });
                }
                catch (error) {
                    validationErrors[merchantSku] = [error instanceof Error ? error.message : 'Bulk delete failed'];
                    results.push({ MerchantProductNo: merchantSku, Success: false });
                }
            }
            const success = Object.keys(validationErrors).length === 0;
            return buildCeMutationEnvelope(success, results, success ? undefined : validationErrors);
        });
    }

    async patchExtraDataBulk(input) {
        return this.runIdempotent(input, ROUTE_PATCH_EXTRA_DATA, JSON.stringify(input.body), async () => {
            this.deps.authorization.requirePermission(input.actorPermissions, 'products.update');
            const items = normalizeExtraDataBatch(input.body);
            const results = [];
            const validationErrors = {};
            for (const item of items) {
                const merchantSku = item.MerchantProductNo?.trim();
                if (merchantSku === undefined || merchantSku.length === 0) {
                    continue;
                }
                try {
                    const product = await this.requireProduct(input.tenantId, merchantSku);
                    let existingAttributes = {};
                    try {
                        const existing = await this.deps.getProductContent.execute({
                            tenantId: input.tenantId,
                            actorPermissions: input.actorPermissions,
                            productId: product.id,
                            locale: 'en',
                        });
                        existingAttributes = existing.content[0]?.attributes ?? {};
                    }
                    catch (error) {
                        if (!(error instanceof NotFoundError)) {
                            throw error;
                        }
                    }
                    const attributes = mergeCeExtraDataAttributes(existingAttributes, item.ExtraData ?? {});
                    await this.deps.upsertProductContent.execute({
                        tenantId: input.tenantId,
                        actorId: input.actorId,
                        actorKind: input.actorKind,
                        actorPermissions: input.actorPermissions,
                        productId: product.id,
                        locale: 'en',
                        attributes,
                    });
                    results.push({ MerchantProductNo: merchantSku, Success: true });
                }
                catch (error) {
                    validationErrors[merchantSku] = [error instanceof Error ? error.message : 'Extra-data update failed'];
                    results.push({ MerchantProductNo: merchantSku, Success: false });
                }
            }
            const success = Object.keys(validationErrors).length === 0;
            return buildCeMutationEnvelope(success, results, success ? undefined : validationErrors);
        });
    }

    async updateOfferPrice(input) {
        return this.runIdempotent(input, ROUTE_PUT_OFFER, JSON.stringify(input.body), async () => {
            const mapped = mapCeOfferPriceRequest(input.body);
            const channel = await resolveCompatibilityChannel(this.deps, {
                tenantId: input.tenantId,
                apiKeyChannelId: input.apiKeyChannelId,
                channelExternalReference: input.channelExternalReference,
                bodyChannelId: mapped.channelIdFromBody,
            });
            const product = await this.requireProduct(input.tenantId, mapped.merchantSku);
            await this.ensureOfferExists(input, product.id, channel.id);
            const effective = await this.deps.pricingService.getEffectivePrice(
                input.tenantId,
                product.id,
                channel.id,
                mapped.currency,
            );
            if (effective === null) {
                this.deps.authorization.requirePermission(input.actorPermissions, 'pricing.create');
                await this.deps.createPrice.execute({
                    tenantId: input.tenantId,
                    actorId: input.actorId,
                    actorKind: input.actorKind,
                    actorPermissions: input.actorPermissions,
                    productId: product.id,
                    channelId: channel.id,
                    currency: mapped.currency,
                    amountMinor: mapped.amountMinor,
                });
            }
            else {
                this.deps.authorization.requirePermission(input.actorPermissions, 'pricing.update');
                await this.deps.updatePrice.execute({
                    tenantId: input.tenantId,
                    actorId: input.actorId,
                    actorKind: input.actorKind,
                    actorPermissions: input.actorPermissions,
                    priceId: effective.id,
                    amountMinor: mapped.amountMinor,
                });
            }
            return buildCeMutationEnvelope(true, {
                MerchantProductNo: mapped.merchantSku,
                ChannelId: channel.externalReference ?? channel.id,
                Success: true,
            });
        });
    }

    async updateOfferStock(input) {
        return this.runIdempotent(input, ROUTE_PUT_OFFER_STOCK, JSON.stringify(input.body), async () => {
            this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');
            const lines = normalizeOfferStockBatch(input.body);
            const results = [];
            const validationErrors = {};
            for (const line of lines) {
                try {
                    const mapped = mapCeOfferStockLine(line);
                    const channel = await resolveCompatibilityChannel(this.deps, {
                        tenantId: input.tenantId,
                        apiKeyChannelId: input.apiKeyChannelId,
                        channelExternalReference: input.channelExternalReference,
                        bodyChannelId: mapped.channelIdFromBody,
                    });
                    const stockLocationId = resolveCompatibilityStockLocationId(channel);
                    const product = await this.requireProduct(input.tenantId, mapped.merchantSku);
                    await this.ensureOfferExists(input, product.id, channel.id);
                    const availability = await this.deps.inventoryService.getAvailability(
                        input.tenantId,
                        product.id,
                        stockLocationId,
                    );
                    const current = readCompatibilityAvailableQuantity(availability, stockLocationId);
                    const delta = mapped.stock - current;
                    if (delta !== 0) {
                        await this.deps.adjustInventory.execute({
                            tenantId: input.tenantId,
                            actorId: input.actorId,
                            actorKind: input.actorKind,
                            actorPermissions: input.actorPermissions,
                            stockLocationId,
                            productId: product.id,
                            delta,
                            referenceType: 'CE_COMPAT',
                            referenceId: `offer-stock-${mapped.merchantSku}`,
                        });
                    }
                    results.push({
                        MerchantProductNo: mapped.merchantSku,
                        Stock: mapped.stock,
                        Success: true,
                    });
                }
                catch (error) {
                    const sku = line.MerchantProductNo?.trim() ?? 'unknown';
                    validationErrors[sku] = [error instanceof Error ? error.message : 'Stock update failed'];
                    results.push({ MerchantProductNo: sku, Success: false });
                }
            }
            const success = Object.keys(validationErrors).length === 0;
            return buildCeMutationEnvelope(success, results, success ? undefined : validationErrors);
        });
    }

    async runIdempotent(input, routeId, requestFingerprint, operation) {
        const outcome = await this.deps.idempotency.execute({
            tenantId: input.tenantId,
            principalFingerprint: input.principalFingerprint,
            routeId,
            idempotencyKey: input.idempotencyKey,
        }, requestFingerprint, async () => operation(), (body) => ({ statusCode: 200, body }));
        if (outcome.kind === 'replayed') {
            return outcome.value;
        }
        return outcome.value;
    }

    /**
     * @param {object} input
     * @param {ReturnType<typeof mapCeProductItemToUpsertCommands>} mapped
     */
    async ensureProductRecord(input, mapped) {
        let product = await this.deps.productQueryService.getProductBySku(input.tenantId, mapped.merchantSku);
        if (product === null) {
            const created = await this.deps.createProduct.execute({
                tenantId: input.tenantId,
                actorId: input.actorId,
                actorKind: input.actorKind,
                actorPermissions: input.actorPermissions,
                merchantSku: mapped.merchantSku,
            });
            product = created.product;
        }
        const attributes = mergeCeExtraDataAttributes(undefined, mapped.extraData);
        if (mapped.title !== null || mapped.description !== null || mapped.brand !== null || mapped.extraData !== undefined) {
            await this.deps.upsertProductContent.execute({
                tenantId: input.tenantId,
                actorId: input.actorId,
                actorKind: input.actorKind,
                actorPermissions: input.actorPermissions,
                productId: product.id,
                locale: mapped.locale,
                title: mapped.title,
                description: mapped.description,
                brand: mapped.brand,
                attributes,
            });
        }
        return product;
    }

    async ensureOfferExists(input, productId, channelId) {
        const existing = await this.deps.offerQueryService.getOfferForProductAndChannel(
            input.tenantId,
            productId,
            channelId,
        );
        if (existing !== null) {
            if (existing.status === 'DRAFT') {
                await this.deps.activateOffer.execute({
                    tenantId: input.tenantId,
                    actorId: input.actorId,
                    actorKind: input.actorKind,
                    actorPermissions: input.actorPermissions,
                    offerId: existing.id,
                    requirePricing: false,
                });
            }
            return existing;
        }
        const created = await this.deps.createOffer.execute({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            productId,
            channelId,
        });
        await this.deps.activateOffer.execute({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            offerId: created.offer.id,
            requirePricing: false,
        });
        return created.offer;
    }

    async requireProduct(tenantId, merchantSku) {
        const product = await this.deps.productQueryService.getProductBySku(tenantId, merchantSku);
        if (product === null) {
            throw new NotFoundError('Product was not found', { merchantSku });
        }
        return product;
    }

    async tryResolveChannel(input) {
        try {
            return await resolveCompatibilityChannel(this.deps, {
                tenantId: input.tenantId,
                apiKeyChannelId: input.apiKeyChannelId,
                channelExternalReference: input.channelExternalReference,
                bodyChannelId: input.body?.ChannelId,
            });
        }
        catch (error) {
            if (error instanceof ValidationError) {
                return null;
            }
            throw error;
        }
    }
}

/**
 * @param {unknown} body
 */
function normalizeProductBatch(body) {
    if (Array.isArray(body)) {
        return body;
    }
    if (body !== null && typeof body === 'object') {
        if (Array.isArray(body.Content)) {
            return body.Content;
        }
        if (body.MerchantProductNo !== undefined) {
            return [body];
        }
    }
    throw new ValidationError('Product batch payload is invalid');
}

/**
 * @param {unknown} body
 */
function normalizeMerchantProductNoList(body) {
    if (body === null || typeof body !== 'object') {
        throw new ValidationError('MerchantProductNoList payload is invalid');
    }
    const list = body.MerchantProductNoList ?? body.merchantProductNoList;
    if (!Array.isArray(list) || list.length === 0) {
        throw new ValidationError('MerchantProductNoList is required');
    }
    return list.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
}

/**
 * @param {unknown} body
 */
function normalizeExtraDataBatch(body) {
    if (body === null || typeof body !== 'object') {
        throw new ValidationError('Extra-data batch payload is invalid');
    }
    if (Array.isArray(body.Content)) {
        return body.Content;
    }
    if (body.MerchantProductNo !== undefined) {
        return [body];
    }
    throw new ValidationError('Extra-data batch payload is invalid');
}

/**
 * @param {unknown} body
 */
function normalizeOfferStockBatch(body) {
    if (Array.isArray(body)) {
        return body;
    }
    if (body !== null && typeof body === 'object') {
        if (Array.isArray(body.Content)) {
            return body.Content;
        }
        if (body.MerchantProductNo !== undefined) {
            return [body];
        }
    }
    throw new ValidationError('Offer stock batch payload is invalid');
}
