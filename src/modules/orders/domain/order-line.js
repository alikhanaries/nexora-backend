import { OrderLineStatus, } from './order-line-status.js';
export class OrderLine {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        const now = props.createdAt ?? new Date();
        return new OrderLine({
            ...props,
            cancelledQuantity: props.cancelledQuantity ?? 0,
            shippedQuantity: props.shippedQuantity ?? 0,
            returnedQuantity: props.returnedQuantity ?? 0,
            status: props.status ?? OrderLineStatus.OPEN,
            createdAt: now,
            updatedAt: props.updatedAt ?? now,
        });
    }
    static reconstitute(props) {
        return new OrderLine(props);
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
    get productId() {
        return this.props.productId;
    }
    get offerId() {
        return this.props.offerId;
    }
    get stockLocationId() {
        return this.props.stockLocationId;
    }
    get merchantSku() {
        return this.props.merchantSku;
    }
    get productTypeSnapshot() {
        return this.props.productTypeSnapshot;
    }
    get quantity() {
        return this.props.quantity;
    }
    get cancelledQuantity() {
        return this.props.cancelledQuantity;
    }
    get shippedQuantity() {
        return this.props.shippedQuantity;
    }
    get returnedQuantity() {
        return this.props.returnedQuantity;
    }
    get unitPriceMinor() {
        return this.props.unitPriceMinor;
    }
    get discountMinor() {
        return this.props.discountMinor;
    }
    get taxMinor() {
        return this.props.taxMinor;
    }
    get lineTotalMinor() {
        return this.props.lineTotalMinor;
    }
    get currency() {
        return this.props.currency;
    }
    get status() {
        return this.props.status;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    cancellableQuantity() {
        return this.props.quantity - this.props.cancelledQuantity - this.props.shippedQuantity;
    }
    shippableQuantity() {
        return this.props.quantity - this.props.cancelledQuantity - this.props.shippedQuantity;
    }
    returnableQuantity() {
        return this.props.shippedQuantity - this.props.returnedQuantity;
    }
    withUpdatedQuantities(patch) {
        return new OrderLine({
            ...this.props,
            ...patch,
            updatedAt: patch.updatedAt ?? new Date(),
        });
    }
    toProps() {
        return { ...this.props };
    }
}
