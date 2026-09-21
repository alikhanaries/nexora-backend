export class CancellationLine {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new CancellationLine({
            ...props,
            createdAt: props.createdAt ?? new Date(),
        });
    }
    static reconstitute(props) {
        return new CancellationLine(props);
    }
    get id() {
        return this.props.id;
    }
    get tenantId() {
        return this.props.tenantId;
    }
    get cancellationId() {
        return this.props.cancellationId;
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
