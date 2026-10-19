import { BusinessRuleError } from '../../../shared/errors/index.js';
import { assertShipmentTransition, isShipmentCancellable, ShipmentStatus, } from './shipment-status.js';
export class Shipment {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        const now = props.createdAt ?? new Date();
        return new Shipment({
            ...props,
            status: props.status ?? ShipmentStatus.CREATED,
            shippedAt: props.shippedAt ?? null,
            deliveredAt: props.deliveredAt ?? null,
            createdAt: now,
            updatedAt: props.updatedAt ?? now,
        });
    }
    static reconstitute(props) {
        return new Shipment(props);
    }
    get id() {
        return this.props.id;
    }
    get tenantId() {
        return this.props.tenantId;
    }
    get orderId() {
        return this.props.orderId;
    }
    get externalReference() {
        return this.props.externalReference ?? null;
    }
    get carrier() {
        return this.props.carrier;
    }
    get service() {
        return this.props.service;
    }
    get trackingNumber() {
        return this.props.trackingNumber;
    }
    get status() {
        return this.props.status;
    }
    get shippedAt() {
        return this.props.shippedAt;
    }
    get deliveredAt() {
        return this.props.deliveredAt;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    transitionTo(next, at = new Date()) {
        assertShipmentTransition(this.props.status, next);
        return new Shipment({
            ...this.props,
            status: next,
            updatedAt: at,
            ...(next === ShipmentStatus.SHIPPED || next === ShipmentStatus.IN_TRANSIT
                ? { shippedAt: this.props.shippedAt ?? at }
                : {}),
            ...(next === ShipmentStatus.DELIVERED ? { deliveredAt: at } : {}),
        });
    }
    withCarrierDetails(patch, at = new Date()) {
        return new Shipment({
            ...this.props,
            carrier: patch.carrier === undefined ? this.props.carrier : patch.carrier,
            service: patch.service === undefined ? this.props.service : patch.service,
            trackingNumber: patch.trackingNumber === undefined ? this.props.trackingNumber : patch.trackingNumber,
            updatedAt: at,
        });
    }
    ship(at = new Date()) {
        if (this.props.status !== ShipmentStatus.CREATED &&
            this.props.status !== ShipmentStatus.READY_TO_SHIP) {
            throw new BusinessRuleError('Only created or ready-to-ship shipments can be shipped', {
                status: this.props.status,
            });
        }
        return this.transitionTo(ShipmentStatus.SHIPPED, at);
    }
    deliver(at = new Date()) {
        if (this.props.status !== ShipmentStatus.SHIPPED &&
            this.props.status !== ShipmentStatus.IN_TRANSIT) {
            throw new BusinessRuleError('Only shipped or in-transit shipments can be delivered', {
                status: this.props.status,
            });
        }
        return this.transitionTo(ShipmentStatus.DELIVERED, at);
    }
    cancel(at = new Date()) {
        if (!isShipmentCancellable(this.props.status)) {
            throw new BusinessRuleError('Shipment cannot be cancelled in its current status', {
                status: this.props.status,
            });
        }
        return this.transitionTo(ShipmentStatus.CANCELLED, at);
    }
    toProps() {
        return { ...this.props };
    }
}
