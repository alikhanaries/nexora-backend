import { BusinessRuleError } from '../../../shared/errors/index.js';
const USER_TRANSITIONS = {
    ACTIVE: ['LOCKED', 'DISABLED'],
    LOCKED: ['ACTIVE', 'DISABLED'],
    DISABLED: [],
};
export class User {
    id;
    email;
    status;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.email = props.email;
        this.status = props.status;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        return new User(props);
    }
    static createNew(id, email) {
        const now = new Date();
        return new User({
            id,
            email,
            status: 'ACTIVE',
            createdAt: now,
            updatedAt: now,
        });
    }
    canAuthenticate() {
        return this.status === 'ACTIVE';
    }
    transitionTo(nextStatus) {
        if (this.status === nextStatus)
            return this;
        const allowed = USER_TRANSITIONS[this.status];
        if (!allowed.includes(nextStatus)) {
            throw new BusinessRuleError(`User status cannot transition from ${this.status} to ${nextStatus}`);
        }
        return new User({
            ...this,
            status: nextStatus,
            updatedAt: new Date(),
        });
    }
}
export function canTransitionUserStatus(from, to) {
    if (from === to)
        return true;
    return USER_TRANSITIONS[from].includes(to);
}
