import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';

/**
 * @param {object} deps
 * @param {import('../public/marketplace-entity-mapping-lookup.port.js').MarketplaceEntityMappingLookup} deps.marketplaceEntityMappingLookup
 * @param {import('../../products/public/index.js').ProductQueryService} deps.productQueryService
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string} input.channelId
 * @param {string} input.marketplaceKey
 * @param {import('./normalized-marketplace-order.schema.js').NormalizedMarketplaceOrder['lines']} input.lines
 * @param {object} [input.queryable]
 */
export async function resolveMarketplaceOrderLines(deps, input) {
    /** @type {import('../../orders/public/order-command-service.js').CreateChannelOrderLineCommand[]} */
    const channelLines = [];
    for (const line of input.lines) {
        const resolved = await resolveSingleLine(deps, input, line);
        channelLines.push({
            stockLocationId: line.stockLocationId,
            quantity: line.quantity,
            ...resolved,
        });
    }
    return channelLines;
}

/**
 * @param {object} deps
 * @param {object} context
 * @param {import('./normalized-marketplace-order.schema.js').NormalizedMarketplaceOrder['lines'][number]} line
 */
async function resolveSingleLine(deps, context, line) {
    if (line.merchantSku !== undefined) {
        return { merchantSku: line.merchantSku.trim() };
    }
    if (line.channelProductNo !== undefined) {
        return { channelProductNo: line.channelProductNo.trim() };
    }
    const external = line.marketplaceExternalEntity;
    if (external === undefined) {
        throw new ValidationError('Marketplace order line is missing product reference');
    }
    const mapping = await deps.marketplaceEntityMappingLookup.findByExternalEntity({
        tenantId: context.tenantId,
        channelId: context.channelId,
        marketplaceKey: context.marketplaceKey,
        externalEntityType: external.externalEntityType.trim(),
        externalEntityId: external.externalEntityId.trim(),
        ...(context.queryable === undefined ? {} : { queryable: context.queryable }),
    });
    if (mapping === null) {
        throw new NotFoundError('No marketplace entity mapping for order line', {
            externalEntityType: external.externalEntityType,
            externalEntityId: external.externalEntityId,
            marketplaceKey: context.marketplaceKey,
        });
    }
    if (mapping.nexoraEntityType === 'offer') {
        return { offerId: mapping.nexoraEntityId };
    }
    if (mapping.nexoraEntityType === 'product') {
        const product = await deps.productQueryService.getProductById(context.tenantId, mapping.nexoraEntityId);
        if (product === null) {
            throw new NotFoundError('Mapped product was not found', {
                productId: mapping.nexoraEntityId,
            });
        }
        return { merchantSku: product.merchantSku };
    }
    throw new ValidationError('Marketplace mapping type cannot be used for order line resolution', {
        nexoraEntityType: mapping.nexoraEntityType,
    });
}
