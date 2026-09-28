import { ValidationError } from '../../../../shared/errors/index.js';
import { decimalPriceToMinorUnits, parseExternalInteger } from './compatibility-catalog-product.mapper.js';

/**
 * @param {object} body
 */
export function mapCeOfferPriceRequest(body) {
    const merchantProductNo = body.MerchantProductNo?.trim();
    if (merchantProductNo === undefined || merchantProductNo.length === 0) {
        throw new ValidationError('MerchantProductNo is required');
    }
    const currency = body.CurrencyCode ?? body.Currency ?? 'USD';
    const priceRaw = body.Price ?? body.UnitPrice;
    if (priceRaw === undefined || priceRaw === null) {
        throw new ValidationError('Price is required');
    }
    const decimalPrice = typeof priceRaw === 'number' ? priceRaw : Number.parseFloat(String(priceRaw));
    return {
        merchantSku: merchantProductNo,
        channelIdFromBody: body.ChannelId,
        currency: String(currency),
        amountMinor: decimalPriceToMinorUnits(String(currency), decimalPrice),
    };
}

/**
 * @param {object} line
 */
export function mapCeOfferStockLine(line) {
    const merchantProductNo = line.MerchantProductNo?.trim();
    if (merchantProductNo === undefined || merchantProductNo.length === 0) {
        throw new ValidationError('MerchantProductNo is required');
    }
    const stockRaw = line.Stock ?? line.StockAvailable ?? line.Quantity;
    if (stockRaw === undefined || stockRaw === null) {
        throw new ValidationError('Stock is required');
    }
    const stock = parseExternalInteger(stockRaw);
    if (stock < 0) {
        throw new ValidationError('Stock must be non-negative');
    }
    return {
        merchantSku: merchantProductNo,
        channelIdFromBody: line.ChannelId ?? undefined,
        stock,
    };
}
