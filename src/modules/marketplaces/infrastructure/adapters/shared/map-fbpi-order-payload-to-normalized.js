import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { parseCurrency } from '../../../../../shared/money/index.js';

/**
 * Maps Noon/Namshi GetFbpiOrder JSON to a normalized marketplace order for ingestion.
 *
 * @param {object} input
 * @param {string} input.marketplaceKey
 * @param {object} input.orderPayload
 * @param {string} input.stockLocationId
 */
export function mapFbpiOrderPayloadToNormalizedMarketplaceOrder(input) {
    const order = input.orderPayload;
    if (order === null || typeof order !== 'object') {
        throw new MarketplaceValidationError('FBPI order payload is invalid');
    }
    const fbpiOrderNr = typeof order.fbpi_order_nr === 'string' ? order.fbpi_order_nr.trim() : '';
    if (fbpiOrderNr.length === 0) {
        throw new MarketplaceValidationError('FBPI order is missing fbpi_order_nr');
    }
    const currencyRaw = typeof order.currency_code === 'string' ? order.currency_code.trim() : 'SAR';
    const currency = parseCurrency(currencyRaw);
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
        throw new MarketplaceValidationError('FBPI order has no line items');
    }
    /** @type {import('../../../../marketplace-order-ingestion/application/normalized-marketplace-order.schema.js').NormalizedMarketplaceOrder['lines']} */
    const lines = [];
    for (const item of items) {
        if (item === null || typeof item !== 'object') {
            continue;
        }
        const partnerSku = typeof item.partner_sku === 'string' ? item.partner_sku.trim() : '';
        const mpItemNr = typeof item.mp_item_nr === 'string' ? item.mp_item_nr.trim() : '';
        if (partnerSku.length === 0 && mpItemNr.length === 0) {
            continue;
        }
        lines.push({
            quantity: 1,
            stockLocationId: input.stockLocationId,
            ...(partnerSku.length > 0 ? { merchantSku: partnerSku } : {}),
            ...(mpItemNr.length > 0 ? { externalLineId: mpItemNr } : {}),
        });
    }
    if (lines.length === 0) {
        throw new MarketplaceValidationError('FBPI order has no mappable line items');
    }
    return {
        externalOrderId: fbpiOrderNr,
        marketplaceKey: input.marketplaceKey,
        status: 'pending',
        currency,
        lines,
    };
}
