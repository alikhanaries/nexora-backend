import { BusinessRuleError } from '../../../shared/errors/index.js';
import {
    assertShipmentTransition,
    isShipmentCancellable,
    ShipmentStatus,
} from './shipment-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   orderId: string,
 *   externalReference: string | null,
 *   carrier: string | null,
 *   service: string | null,
 *   trackingNumber: string | null,
 *   status: string,
 *   shippedAt: Date | null,
 *   deliveredAt: Date | null,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} Shipment
 */

/**
 * @param {Omit<Shipment, 'status' | 'shippedAt' | 'deliveredAt' | 'updatedAt'> & {
 *   status?: string,
 *   shippedAt?: Date | null,
 *   deliveredAt?: Date | null,
 *   updatedAt?: Date,
 * }} props
 * @returns {Shipment}
 */
export function createShipmentEntity(props) {
    const now = props.createdAt ?? new Date();
    return {
        id: props.id,
        tenantId: props.tenantId,
        orderId: props.orderId,
        externalReference: props.externalReference ?? null,
        carrier: props.carrier,
        service: props.service,
        trackingNumber: props.trackingNumber,
        status: props.status ?? ShipmentStatus.CREATED,
        shippedAt: props.shippedAt ?? null,
        deliveredAt: props.deliveredAt ?? null,
        createdAt: now,
        updatedAt: props.updatedAt ?? now,
    };
}

/**
 * @param {Shipment} props
 * @returns {Shipment}
 */
export function reconstituteShipment(props) {
    return { ...props };
}

/**
 * @param {Shipment} shipment
 * @param {string} next
 * @param {Date} [at]
 * @returns {Shipment}
 */
export function transitionShipmentEntity(shipment, next, at = new Date()) {
    assertShipmentTransition(shipment.status, next);
    return {
        ...shipment,
        status: next,
        updatedAt: at,
        ...(next === ShipmentStatus.SHIPPED || next === ShipmentStatus.IN_TRANSIT
            ? { shippedAt: shipment.shippedAt ?? at }
            : {}),
        ...(next === ShipmentStatus.DELIVERED ? { deliveredAt: at } : {}),
    };
}

/**
 * @param {Shipment} shipment
 * @param {{ carrier?: string | null, service?: string | null, trackingNumber?: string | null }} patch
 * @param {Date} [at]
 * @returns {Shipment}
 */
export function withShipmentCarrierDetails(shipment, patch, at = new Date()) {
    return {
        ...shipment,
        carrier: patch.carrier === undefined ? shipment.carrier : patch.carrier,
        service: patch.service === undefined ? shipment.service : patch.service,
        trackingNumber: patch.trackingNumber === undefined ? shipment.trackingNumber : patch.trackingNumber,
        updatedAt: at,
    };
}

/**
 * @param {Shipment} shipment
 * @param {Date} [at]
 * @returns {Shipment}
 */
export function shipShipmentEntity(shipment, at = new Date()) {
    if (shipment.status !== ShipmentStatus.CREATED &&
        shipment.status !== ShipmentStatus.READY_TO_SHIP) {
        throw new BusinessRuleError('Only created or ready-to-ship shipments can be shipped', {
            status: shipment.status,
        });
    }
    return transitionShipmentEntity(shipment, ShipmentStatus.SHIPPED, at);
}

/**
 * @param {Shipment} shipment
 * @param {Date} [at]
 * @returns {Shipment}
 */
export function deliverShipmentEntity(shipment, at = new Date()) {
    if (shipment.status !== ShipmentStatus.SHIPPED &&
        shipment.status !== ShipmentStatus.IN_TRANSIT) {
        throw new BusinessRuleError('Only shipped or in-transit shipments can be delivered', {
            status: shipment.status,
        });
    }
    return transitionShipmentEntity(shipment, ShipmentStatus.DELIVERED, at);
}

/**
 * @param {Shipment} shipment
 * @param {Date} [at]
 * @returns {Shipment}
 */
export function cancelShipmentEntity(shipment, at = new Date()) {
    if (!isShipmentCancellable(shipment.status)) {
        throw new BusinessRuleError('Shipment cannot be cancelled in its current status', {
            status: shipment.status,
        });
    }
    return transitionShipmentEntity(shipment, ShipmentStatus.CANCELLED, at);
}
