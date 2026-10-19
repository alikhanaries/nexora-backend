export class ShipmentLine {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new ShipmentLine({
            ...props,
            createdAt: props.createdAt ?? new Date(),
        });
    }
    static reconstitute(props) {
        return new ShipmentLine(props);
    }
    get id() {
        return this.props.id;
    }
    get tenantId() {
        return this.props.tenantId;
    }
    get shipmentId() {
        return this.props.shipmentId;
    }
    get orderLineId() {
        return this.props.orderLineId;
    }
    get quantity() {
        return this.props.quantity;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    toProps() {
        return { ...this.props };
    }
}
