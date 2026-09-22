import { BusinessRuleError, NotFoundError, ValidationError, } from '../../../shared/errors/index.js';

/**
 * @param {object} deps
 * @param {import('../../products/public/index.js').ProductQueryService} deps.productQueryService
 * @param {import('../../offers/public/index.js').OfferQueryService} deps.offerQueryService
 * @param {import('../../pricing/public/index.js').PricingService} deps.pricingService
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string} input.channelId
 * @param {string} input.currency
 * @param {object[]} input.lines
 * @param {{ skuFirst?: boolean }} [options]
 */
export async function resolveOrderLines(deps, input, options = {}) {
    const skuFirst = options.skuFirst === true;
    const resolvedLines = [];
    for (const line of input.lines) {
        if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
            throw new ValidationError('Line quantity must be a positive integer');
        }
        const product = skuFirst
            ? await resolveChannelLineProduct(deps, input.tenantId, input.channelId, line)
            : await resolveNativeLineProduct(deps, input.tenantId, line);
        if (product.status !== 'ACTIVE') {
            throw new BusinessRuleError('Product is not active', { productId: product.id });
        }
        let offerId = line.offerId ?? null;
        if (offerId !== null) {
            await deps.offerQueryService.verifyOfferUsable(input.tenantId, offerId);
        }
        else {
            const offer = await deps.offerQueryService.getOfferForProductAndChannel(input.tenantId, product.id, input.channelId);
            if (offer !== null) {
                if (offer.status !== 'ACTIVE') {
                    throw new BusinessRuleError('Offer is not usable for this product and channel', {
                        productId: product.id,
                        channelId: input.channelId,
                    });
                }
                offerId = offer.id;
            }
        }
        const price = await deps.pricingService.getEffectivePrice(input.tenantId, product.id, input.channelId, input.currency);
        if (price === null) {
            throw new NotFoundError('No effective price found for product and channel', {
                productId: product.id,
                channelId: input.channelId,
                currency: input.currency,
            });
        }
        const lineTotalMinor = price.amountMinor * line.quantity;
        resolvedLines.push({
            input: line,
            productId: product.id,
            merchantSku: product.merchantSku,
            productTypeSnapshot: product.productType,
            unitPriceMinor: price.amountMinor,
            lineTotalMinor,
            offerId,
        });
    }
    return resolvedLines;
}

/**
 * @param {object} deps
 * @param {string} tenantId
 * @param {object} line
 */
async function resolveNativeLineProduct(deps, tenantId, line) {
    if (line.productId === undefined) {
        throw new ValidationError('Line productId is required');
    }
    const product = await deps.productQueryService.getProductById(tenantId, line.productId);
    if (product === null) {
        throw new NotFoundError('Product was not found', {
            tenantId,
            productId: line.productId,
        });
    }
    return product;
}

/**
 * @param {object} deps
 * @param {string} tenantId
 * @param {string} channelId
 * @param {object} line
 */
async function resolveChannelLineProduct(deps, tenantId, channelId, line) {
    const merchantSku = normalizeOptionalLineReference(line.merchantSku);
    if (merchantSku !== null) {
        const product = await deps.productQueryService.getProductBySku(tenantId, merchantSku);
        if (product === null) {
            throw new NotFoundError('Product was not found for merchant SKU', {
                tenantId,
                merchantSku,
            });
        }
        return product;
    }
    const channelProductNo = normalizeOptionalLineReference(line.channelProductNo);
    if (channelProductNo !== null) {
        const offer = await deps.offerQueryService.getOfferByExternalReference(tenantId, channelId, channelProductNo);
        if (offer === null) {
            throw new NotFoundError('Offer was not found for channel product reference', {
                tenantId,
                channelId,
                channelProductNo,
            });
        }
        const product = await deps.productQueryService.getProductById(tenantId, offer.productId);
        if (product === null) {
            throw new NotFoundError('Product was not found for channel product reference', {
                tenantId,
                productId: offer.productId,
                channelProductNo,
            });
        }
        return product;
    }
    if (line.productId !== undefined) {
        const product = await deps.productQueryService.getProductById(tenantId, line.productId);
        if (product === null) {
            throw new NotFoundError('Product was not found', {
                tenantId,
                productId: line.productId,
            });
        }
        return product;
    }
    throw new ValidationError('Line must specify merchantSku, channelProductNo, or productId');
}

/**
 * @param {string|null|undefined} value
 */
function normalizeOptionalLineReference(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}
