import { BusinessRuleError } from '../../../shared/errors/index.js';
import { CancellationStatus, } from './cancellation-status.js';
export class Cancellation {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        const now = props.createdAt ?? new Date();
        return new Cancellation({
            ...props,
            status: props.status ?? CancellationStatus.REQUESTED,
            completedAt: props.completedAt ?? null,
            createdAt: now,
            updatedAt: props.updatedAt ?? now,
        });
    }
    static reconstitute(props) {
        return new Cancellation(props);
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
    get completedAt() {
        return this.props.completedAt;
    }
    complete(at = new Date()) {
        if (this.props.status !== CancellationStatus.REQUESTED) {
            throw new BusinessRuleError('Only requested cancellations can be completed', {
                cancellationId: this.props.id,
                status: this.props.status,
            });
        }
        return new Cancellation({
            ...this.props,
            status: CancellationStatus.COMPLETED,
            completedAt: at,
            updatedAt: at,
        });
    }
    reject(at = new Date()) {
        if (this.props.status !== CancellationStatus.REQUESTED) {
            throw new BusinessRuleError('Only requested cancellations can be rejected', {
                cancellationId: this.props.id,
                status: this.props.status,
            });
        }
        return new Cancellation({
            ...this.props,
            status: CancellationStatus.REJECTED,
            updatedAt: at,
        });
    }
    toProps() {
        return { ...this.props };
    }
}
