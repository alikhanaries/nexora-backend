import { BusinessRuleError } from '../../../shared/errors/index.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   stockLocationId: string,
 *   productId: string,
 *   onHand: number,
 *   reserved: number,
 *   available: number,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} InventoryBalance
 */

/**
 * @param {InventoryBalance} props
 * @returns {InventoryBalance}
 */
export function reconstituteInventoryBalance(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        stockLocationId: props.stockLocationId,
        productId: props.productId,
        onHand: props.onHand,
        reserved: props.reserved,
        available: props.available,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {number} onHand
 * @param {number} reserved
 * @param {number} available
 */
export function assertInventoryBalanceInvariant(onHand, reserved, available) {
    if (available !== onHand - reserved) {
        throw new BusinessRuleError('Inventory invariant violated: available must equal on_hand - reserved');
    }
    if (onHand < 0 || reserved < 0 || available < 0) {
        throw new BusinessRuleError('Inventory quantities cannot be negative');
    }
    if (reserved > onHand) {
        throw new BusinessRuleError('Reserved quantity cannot exceed on-hand quantity');
    }
}
