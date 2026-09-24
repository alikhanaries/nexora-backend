import { BusinessRuleError, ValidationError } from '../../../../shared/errors/index.js';
import { getCurrencyMinorUnitExponent, parseCurrency } from '../../../../shared/money/index.js';
import { mapExternalOrder } from './compatibility-order.mapper.js';

const STOCK_LOCATION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {string|number} value
 */
function parsePositiveInteger(value) {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ValidationError('Quantity must be a positive integer');
    }
    return parsed;
}

/**
 * @param {string} currency
 * @param {string|number} decimal
 */
function decimalToMinorUnits(currency, decimal) {
    const normalizedCurrency = parseCurrency(currency);
    const amount = typeof decimal === 'number' ? decimal : Number.parseFloat(String(decimal));
    if (!Number.isFinite(amount) || amount < 0) {
        throw new ValidationError('Amount must be a non-negative number');
    }
    const exponent = getCurrencyMinorUnitExponent(normalizedCurrency);
    const minor = Math.round(amount * (10 ** exponent));
    if (!Number.isSafeInteger(minor)) {
        throw new ValidationError('Amount exceeds safe integer range');
    }
    return minor;
}

/**
 * @param {object|null|undefined} address
 */
function mapExternalAddressToCore(address) {
    if (address === null || address === undefined) {
        return null;
    }
    const line1 = address.Line1?.trim()
        || [address.StreetName?.trim(), address.HouseNr?.trim(), address.HouseNrAddition?.trim()]
            .filter((part) => part !== undefined && part.length > 0)
            .join(' ')
        || null;
    return {
        line1,
        line2: address.Line2?.trim() || null,
        city: address.City?.trim() || null,
        region: address.Region?.trim() || null,
        postalCode: address.ZipCode?.trim() || null,
        countryCode: address.CountryIso?.trim()?.toUpperCase() || null,
    };
}

/**
 * Resolves the stock location UUID for channel ingest lines from the channel configuration.
 *
 * Prefers `channels.defaultStockLocationId` when set; otherwise falls back to
 * `configurationReference` storing the Nexora stock location UUID (legacy convention).
 *
 * @param {object} channel
 */
export function resolveChannelStockLocationId(channel) {
    const defaultStockLocationId = channel.defaultStockLocationId?.trim?.() ?? channel.defaultStockLocationId;
    if (defaultStockLocationId !== undefined &&
        defaultStockLocationId !== null &&
        String(defaultStockLocationId).length > 0) {
        const normalized = String(defaultStockLocationId).trim();
        if (!STOCK_LOCATION_UUID_PATTERN.test(normalized)) {
            throw new BusinessRuleError('Channel default stock location must be a stock location UUID', {
                channelId: channel.id,
                defaultStockLocationId: normalized,
            });
        }
        return normalized;
    }
    const configurationReference = channel.configurationReference?.trim();
    if (configurationReference === undefined || configurationReference.length === 0) {
        throw new BusinessRuleError('Channel stock location is not configured', {
            channelId: channel.id,
        });
    }
    if (!STOCK_LOCATION_UUID_PATTERN.test(configurationReference)) {
        throw new BusinessRuleError('Channel stock location configuration must be a stock location UUID', {
            channelId: channel.id,
            configurationReference,
        });
    }
    return configurationReference;
}

/**
 * Maps a verified Channel API create-order request to the core createChannelOrder input.
 *
 * @param {object} body
 * @param {object} context
 * @param {string} context.channelId
 * @param {string} context.stockLocationId
 */
export function mapExternalChannelOrderRequest(body, context) {
    const externalOrderReference = body.ChannelOrderNo?.trim();
    if (externalOrderReference === undefined || externalOrderReference.length === 0) {
        throw new ValidationError('ChannelOrderNo is required');
    }
    const currency = parseCurrency(body.CurrencyCode);
    const shippingMinor = decimalToMinorUnits(currency, body.ShippingCostsInclVat ?? 0);
    const lines = body.Lines ?? [];
    if (lines.length === 0) {
        throw new ValidationError('Order must contain at least one line');
    }
    const mappedLines = lines.map((line) => {
        const quantity = parsePositiveInteger(line.Quantity);
        const merchantSku = line.MerchantProductNo?.trim();
        const channelProductNo = line.ChannelProductNo?.trim();
        if ((merchantSku === undefined || merchantSku.length === 0)
            && (channelProductNo === undefined || channelProductNo.length === 0)) {
            throw new ValidationError('Each line must include MerchantProductNo or ChannelProductNo');
        }
        return {
            stockLocationId: context.stockLocationId,
            quantity,
            ...(merchantSku === undefined || merchantSku.length === 0 ? {} : { merchantSku }),
            ...(channelProductNo === undefined || channelProductNo.length === 0 ? {} : { channelProductNo }),
        };
    });
    const billingAddress = mapExternalAddressToCore(body.BillingAddress);
    const shippingAddress = mapExternalAddressToCore(body.ShippingAddress);
    return {
        channelId: context.channelId,
        externalOrderReference,
        currency,
        shippingMinor,
        lines: mappedLines,
        customer: {
            firstName: body.BillingAddress?.FirstName?.trim()
                || body.ShippingAddress?.FirstName?.trim()
                || null,
            lastName: body.BillingAddress?.LastName?.trim()
                || body.ShippingAddress?.LastName?.trim()
                || null,
            email: body.Email?.trim() || null,
            phone: body.Phone?.trim() || null,
            companyName: body.BillingAddress?.CompanyName?.trim()
                || body.ShippingAddress?.CompanyName?.trim()
                || null,
            billingAddress,
            shippingAddress,
        },
    };
}

/**
 * @param {{ order: object, channel?: object|null }} result
 */
export function mapChannelOrderResultToExternalResponse(result, externalIdMaps) {
    return {
        Success: true,
        StatusCode: 201,
        Content: mapExternalOrder(result.order, result.channel ?? null, externalIdMaps),
    };
}

/**
 * @param {object} mapped
 */
/**
 * Maps a verified Channel API channel-fulfilled request to core input.
 *
 * @param {object} body
 * @param {object} context
 * @param {string} context.channelId
 * @param {string} context.stockLocationId
 */
export function mapExternalChannelFulfilledOrderRequest(body, context) {
    const mapped = mapExternalChannelOrderRequest(body, context);
    const externalOrderReference = mapped.externalOrderReference;
    return {
        ...mapped,
        shipment: {
            externalReference: `${externalOrderReference}-fulfillment`,
            carrier: body.ShippingMethod?.trim() || null,
            service: body.ShippingServiceLevel?.trim() || null,
            trackingNumber: null,
        },
    };
}

/**
 * @param {{ order: object, shipment?: object|null, channel?: object|null }} result
 */
export function mapChannelFulfilledOrderResultToExternalResponse(result, externalIdMaps) {
    return mapChannelOrderResultToExternalResponse({
        order: result.order,
        channel: result.channel ?? null,
    }, externalIdMaps);
}

/**
 * @param {object} mapped
 */
export function fingerprintChannelFulfilledOrderCommand(mapped) {
    return JSON.stringify({
        channelId: mapped.channelId,
        externalOrderReference: mapped.externalOrderReference,
        currency: mapped.currency,
        shippingMinor: mapped.shippingMinor,
        lines: mapped.lines.map((line) => ({
            stockLocationId: line.stockLocationId,
            quantity: line.quantity,
            ...(line.merchantSku === undefined ? {} : { merchantSku: line.merchantSku }),
            ...(line.channelProductNo === undefined ? {} : { channelProductNo: line.channelProductNo }),
            ...(line.productId === undefined ? {} : { productId: line.productId }),
            ...(line.offerId === undefined ? {} : { offerId: line.offerId }),
        })),
        customer: mapped.customer,
        shipment: mapped.shipment,
    });
}

export function fingerprintChannelOrderCommand(mapped) {
    return JSON.stringify({
        channelId: mapped.channelId,
        externalOrderReference: mapped.externalOrderReference,
        currency: mapped.currency,
        shippingMinor: mapped.shippingMinor,
        lines: mapped.lines.map((line) => ({
            stockLocationId: line.stockLocationId,
            quantity: line.quantity,
            ...(line.merchantSku === undefined ? {} : { merchantSku: line.merchantSku }),
            ...(line.channelProductNo === undefined ? {} : { channelProductNo: line.channelProductNo }),
            ...(line.productId === undefined ? {} : { productId: line.productId }),
            ...(line.offerId === undefined ? {} : { offerId: line.offerId }),
        })),
        customer: mapped.customer,
    });
}
