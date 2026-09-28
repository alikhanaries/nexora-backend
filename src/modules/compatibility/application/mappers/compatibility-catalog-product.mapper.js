import { ValidationError } from '../../../../shared/errors/index.js';
import { getCurrencyMinorUnitExponent } from '../../../../shared/money/currency-exponents.js';
import { parseCurrency } from '../../../../shared/money/money.js';

const DEFAULT_LOCALE = 'en';

/**
 * @param {number|string} value
 */
export function parseExternalInteger(value) {
    const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isInteger(n)) {
        throw new ValidationError('Expected an integer value');
    }
    return n;
}

/**
 * @param {string} currency
 * @param {number} decimalAmount
 */
export function decimalPriceToMinorUnits(currency, decimalAmount) {
    if (typeof decimalAmount !== 'number' || !Number.isFinite(decimalAmount) || decimalAmount < 0) {
        throw new ValidationError('Price must be a non-negative number');
    }
    const normalizedCurrency = parseCurrency(currency);
    const exponent = getCurrencyMinorUnitExponent(normalizedCurrency);
    const minor = Math.round(decimalAmount * (10 ** exponent));
    if (minor <= 0) {
        throw new ValidationError('Price must be positive in minor units');
    }
    return minor;
}

/**
 * @param {Record<string, string>|null|undefined} extraData
 * @param {Record<string, unknown>|undefined} existingAttributes
 */
export function mergeCeExtraDataAttributes(existingAttributes, extraData) {
    if (extraData === undefined || extraData === null || Object.keys(extraData).length === 0) {
        return existingAttributes ?? {};
    }
    const prior = existingAttributes ?? {};
    const priorCe = prior.ceExtraData !== undefined && typeof prior.ceExtraData === 'object' && prior.ceExtraData !== null
        ? prior.ceExtraData
        : {};
    return {
        ...prior,
        ceExtraData: {
            ...priorCe,
            ...extraData,
        },
    };
}

/**
 * @param {object} item CE product payload item
 */
export function mapCeProductItemToUpsertCommands(item) {
    const merchantProductNo = item.MerchantProductNo?.trim();
    if (merchantProductNo === undefined || merchantProductNo.length === 0) {
        throw new ValidationError('MerchantProductNo is required');
    }
    const title = item.Name === undefined || item.Name === null ? null : String(item.Name).trim() || null;
    const description = item.Description === undefined || item.Description === null
        ? null
        : String(item.Description).trim() || null;
    const brand = item.Brand === undefined || item.Brand === null ? null : String(item.Brand).trim() || null;
    const extraData = item.ExtraData ?? undefined;
    return {
        merchantSku: merchantProductNo,
        locale: DEFAULT_LOCALE,
        title,
        description,
        brand,
        extraData,
        externalReferenceFromExtra: extraData === undefined ? undefined : JSON.stringify(extraData),
    };
}

/**
 * @param {object} product Nexora product DTO
 * @param {object|null} content product content DTO
 */
export function mapProductToCeCatalogItem(product, content) {
    const attributes = content?.attributes ?? {};
    const ceExtra = attributes.ceExtraData !== undefined && typeof attributes.ceExtraData === 'object'
        ? attributes.ceExtraData
        : {};
    return {
        MerchantProductNo: product.merchantSku,
        Name: content?.title ?? null,
        Description: content?.description ?? null,
        Brand: content?.brand ?? null,
        ExtraData: Object.keys(ceExtra).length > 0 ? ceExtra : null,
    };
}

/**
 * @param {boolean} success
 * @param {unknown} content
 * @param {Record<string, string[]>|undefined} validationErrors
 */
export function buildCeMutationEnvelope(success, content, validationErrors = undefined) {
    return {
        Success: success,
        Message: success ? null : 'One or more items failed validation or processing',
        ValidationErrors: validationErrors ?? {},
        Content: content,
    };
}
