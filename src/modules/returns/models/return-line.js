export class ReturnLine {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        const now = props.createdAt ?? new Date();
        return new ReturnLine({
            ...props,
            createdAt: now,
            updatedAt: props.updatedAt ?? now,
        });
    }
    static reconstitute(props) {
        return new ReturnLine(props);
    }
    get id() {
        return this.props.id;
    }
    get tenantId() {
        return this.props.tenantId;
    }
    get returnId() {
        return this.props.returnId;
    }
    get orderLineId() {
        return this.props.orderLineId;
    }
    get quantity() {
        return this.props.quantity;
    }
    get reason() {
        return this.props.reason;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    toProps() {
        return { ...this.props };
    }
}
