import { BusinessRuleError } from '../../../shared/errors/index.js';
import { assertReturnTransition, ReturnStatus, } from './return-status.js';
export class Return {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        const now = props.createdAt ?? new Date();
        return new Return({
            ...props,
            status: props.status ?? ReturnStatus.REQUESTED,
            receivedAt: props.receivedAt ?? null,
            completedAt: props.completedAt ?? null,
            createdAt: now,
            updatedAt: props.updatedAt ?? now,
        });
    }
    static reconstitute(props) {
        return new Return(props);
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
    get shipmentId() {
        return this.props.shipmentId;
    }
    get status() {
        return this.props.status;
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
    get receivedAt() {
        return this.props.receivedAt;
    }
    get completedAt() {
        return this.props.completedAt;
    }
    approve(at = new Date()) {
        assertReturnTransition(this.props.status, ReturnStatus.APPROVED);
        return this.withStatus(ReturnStatus.APPROVED, at);
    }
    receive(at = new Date()) {
        if (this.props.status === ReturnStatus.RECEIVED) {
            return this;
        }
        assertReturnTransition(this.props.status, ReturnStatus.RECEIVED);
        return new Return({
            ...this.props,
            status: ReturnStatus.RECEIVED,
            updatedAt: at,
            receivedAt: at,
        });
    }
    complete(at = new Date()) {
        assertReturnTransition(this.props.status, ReturnStatus.COMPLETED);
        return new Return({
            ...this.props,
            status: ReturnStatus.COMPLETED,
            updatedAt: at,
            completedAt: at,
        });
    }
    reject(at = new Date()) {
        assertReturnTransition(this.props.status, ReturnStatus.REJECTED);
        return this.withStatus(ReturnStatus.REJECTED, at);
    }
    cancel(at = new Date()) {
        assertReturnTransition(this.props.status, ReturnStatus.CANCELLED);
        return this.withStatus(ReturnStatus.CANCELLED, at);
    }
    withStatus(status, at) {
        if (this.props.status === status) {
            throw new BusinessRuleError('Return is already in the requested status', {
                returnId: this.props.id,
                status,
            });
        }
        return new Return({
            ...this.props,
            status,
            updatedAt: at,
        });
    }
    toProps() {
        return { ...this.props };
    }
}
