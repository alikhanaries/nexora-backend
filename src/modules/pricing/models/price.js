import { BusinessRuleError } from '../../../shared/errors/index.js';
import { createMoney } from '../../../shared/money/index.js';
import { PriceStatus } from './price-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   productId: string,
 *   channelId: string | null,
 *   currency: string,
 *   amountMinor: number,
 *   validFrom: Date,
 *   validTo: Date | null,
 *   status: string,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} Price
 */

/**
 * @param {object} props
 * @returns {Price}
 */
export function createPriceEntity(props) {
    const money = createMoney(props.currency, props.amountMinor);
    const validTo = props.validTo ?? null;
    if (validTo !== null && validTo <= props.validFrom) {
        throw new BusinessRuleError('validTo must be after validFrom');
    }
    return {
        id: props.id,
        tenantId: props.tenantId,
        productId: props.productId,
        channelId: props.channelId ?? null,
        currency: money.currency,
        amountMinor: money.amountMinor,
        validFrom: props.validFrom,
        validTo,
        status: PriceStatus.ACTIVE,
        createdAt: props.createdAt,
        updatedAt: props.createdAt,
    };
}

/**
 * @param {Price} props
 * @returns {Price}
 */
export function reconstitutePrice(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        productId: props.productId,
        channelId: props.channelId,
        currency: props.currency,
        amountMinor: props.amountMinor,
        validFrom: props.validFrom,
        validTo: props.validTo,
        status: props.status,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {Price} price
 * @param {Date} at
 * @returns {boolean}
 */
export function isPriceEffectiveAt(price, at) {
    if (price.status !== PriceStatus.ACTIVE)
        return false;
    if (price.validFrom > at)
        return false;
    if (price.validTo !== null && at >= price.validTo)
        return false;
    return true;
}

/**
 * @param {Price} price
 * @param {object} fields
 * @param {Date} at
 * @returns {Price}
 */
export function updatePriceEntity(price, fields, at) {
    if (price.status === PriceStatus.INACTIVE) {
        throw new BusinessRuleError('Inactive prices cannot be updated');
    }
    const currency = price.currency;
    const amountMinor = fields.amountMinor === undefined
        ? price.amountMinor
        : createMoney(currency, fields.amountMinor).amountMinor;
    const validFrom = fields.validFrom ?? price.validFrom;
    const validTo = fields.validTo === undefined ? price.validTo : fields.validTo;
    const channelId = fields.channelId === undefined ? price.channelId : fields.channelId;
    if (validTo !== null && validTo <= validFrom) {
        throw new BusinessRuleError('validTo must be after validFrom');
    }
    return {
        id: price.id,
        tenantId: price.tenantId,
        productId: price.productId,
        channelId: channelId ?? null,
        currency,
        amountMinor,
        validFrom,
        validTo,
        status: price.status,
        createdAt: price.createdAt,
        updatedAt: at,
    };
}

/**
 * @param {Price} price
 * @param {Date} at
 * @returns {Price}
 */
export function deactivatePriceEntity(price, at) {
    if (price.status === PriceStatus.INACTIVE) {
        throw new BusinessRuleError('Price is already inactive');
    }
    return {
        id: price.id,
        tenantId: price.tenantId,
        productId: price.productId,
        channelId: price.channelId,
        currency: price.currency,
        amountMinor: price.amountMinor,
        validFrom: price.validFrom,
        validTo: price.validTo,
        status: PriceStatus.INACTIVE,
        createdAt: price.createdAt,
        updatedAt: at,
    };
}
