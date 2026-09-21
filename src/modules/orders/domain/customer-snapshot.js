export class CustomerSnapshot {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new CustomerSnapshot({
            ...props,
            createdAt: props.createdAt ?? new Date(),
        });
    }
    static reconstitute(props) {
        return new CustomerSnapshot(props);
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
    get externalCustomerReference() {
        return this.props.externalCustomerReference;
    }
    get firstName() {
        return this.props.firstName;
    }
    get lastName() {
        return this.props.lastName;
    }
    get email() {
        return this.props.email;
    }
    get phone() {
        return this.props.phone;
    }
    get companyName() {
        return this.props.companyName;
    }
    get billingAddress() {
        return this.props.billingAddress;
    }
    get shippingAddress() {
        return this.props.shippingAddress;
    }
    get metadata() {
        return this.props.metadata;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    toProps() {
        return { ...this.props };
    }
}
