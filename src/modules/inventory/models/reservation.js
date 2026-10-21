import { BusinessRuleError } from '../../../shared/errors/index.js';
import { ReservationStatus as Status } from './reservation-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   stockLocationId: string,
 *   productId: string,
 *   referenceType: string,
 *   referenceId: string,
 *   quantity: number,
 *   status: string,
 *   createdAt: Date,
 *   releasedAt: Date | null,
 * }} InventoryReservation
 */

/**
 * @param {InventoryReservation} props
 * @returns {InventoryReservation}
 */
export function reconstituteInventoryReservation(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        stockLocationId: props.stockLocationId,
        productId: props.productId,
        referenceType: props.referenceType,
        referenceId: props.referenceId,
        quantity: props.quantity,
        status: props.status,
        createdAt: props.createdAt,
        releasedAt: props.releasedAt,
    };
}

/**
 * @param {InventoryReservation} reservation
 * @returns {boolean}
 */
export function isInventoryReservationReleased(reservation) {
    return reservation.status === Status.RELEASED;
}

/**
 * @param {InventoryReservation} reservation
 */
export function assertInventoryReservationActive(reservation) {
    if (reservation.status !== Status.ACTIVE) {
        throw new BusinessRuleError('Reservation is not active', {
            reservationId: reservation.id,
            status: reservation.status,
        });
    }
}
