import { assertOrderTransition, OrderStatus, } from './order-status.js';
export class Order {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        const now = props.createdAt ?? new Date();
        return new Order({
            ...props,
            status: props.status ?? OrderStatus.CONFIRMED,
            confirmedAt: props.confirmedAt ?? now,
            cancelledAt: props.cancelledAt ?? null,
            shippedAt: props.shippedAt ?? null,
            deliveredAt: props.deliveredAt ?? null,
            createdAt: now,
            updatedAt: props.updatedAt ?? now,
        });
    }
    static reconstitute(props) {
        return new Order(props);
    }
    get id() {
        return this.props.id;
    }
    get tenantId() {
        return this.props.tenantId;
    }
    get channelId() {
        return this.props.channelId;
    }
    get externalOrderReference() {
        return this.props.externalOrderReference;
    }
    get orderNumber() {
        return this.props.orderNumber;
    }
    get status() {
        return this.props.status;
    }
    get currency() {
        return this.props.currency;
    }
    get subtotalMinor() {
        return this.props.subtotalMinor;
    }
    get discountMinor() {
        return this.props.discountMinor;
    }
    get taxMinor() {
        return this.props.taxMinor;
    }
    get shippingMinor() {
        return this.props.shippingMinor;
    }
    get totalMinor() {
        return this.props.totalMinor;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    get confirmedAt() {
        return this.props.confirmedAt;
    }
    get cancelledAt() {
        return this.props.cancelledAt;
    }
    get shippedAt() {
        return this.props.shippedAt;
    }
    get deliveredAt() {
        return this.props.deliveredAt;
    }
    transitionTo(next, at = new Date()) {
        assertOrderTransition(this.props.status, next);
        return new Order({
            ...this.props,
            status: next,
            updatedAt: at,
            ...(next === OrderStatus.CONFIRMED ? { confirmedAt: at } : {}),
            ...(next === OrderStatus.CANCELLED ? { cancelledAt: at } : {}),
            ...(next === OrderStatus.SHIPPED ? { shippedAt: at } : {}),
            ...(next === OrderStatus.DELIVERED ? { deliveredAt: at } : {}),
        });
    }
    toProps() {
        return { ...this.props };
    }
}
