import { BusinessRuleError } from '../../../shared/errors/index.js';
const MEMBERSHIP_TRANSITIONS = {
    PENDING: ['ACTIVE', 'REVOKED'],
    ACTIVE: ['SUSPENDED', 'REVOKED'],
    SUSPENDED: ['ACTIVE', 'REVOKED'],
    REVOKED: [],
};
export class Membership {
    id;
    tenantId;
    userId;
    status;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.tenantId = props.tenantId;
        this.userId = props.userId;
        this.status = props.status;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        return new Membership(props);
    }
    static createPending(id, tenantId, userId) {
        const now = new Date();
        return new Membership({
            id,
            tenantId,
            userId,
            status: 'PENDING',
            createdAt: now,
            updatedAt: now,
        });
    }
    grantsAccess() {
        return this.status === 'ACTIVE';
    }
    isTerminal() {
        return this.status === 'REVOKED';
    }
    activate() {
        return this.transitionTo('ACTIVE');
    }
    suspend() {
        return this.transitionTo('SUSPENDED');
    }
    revoke() {
        return this.transitionTo('REVOKED');
    }
    transitionTo(nextStatus) {
        if (this.status === nextStatus)
            return this;
        const allowed = MEMBERSHIP_TRANSITIONS[this.status];
        if (!allowed.includes(nextStatus)) {
            throw new BusinessRuleError(`Membership status cannot transition from ${this.status} to ${nextStatus}`);
        }
        return new Membership({
            ...this,
            status: nextStatus,
            updatedAt: new Date(),
        });
    }
}
export function canTransitionMembershipStatus(from, to) {
    if (from === to)
        return true;
    return MEMBERSHIP_TRANSITIONS[from].includes(to);
}
