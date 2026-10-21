import { BusinessRuleError } from '../../../shared/errors/index.js';

/** @typedef {import('./email.js').EmailValue} EmailValue */

/**
 * @typedef {{
 *   id: string,
 *   email: EmailValue,
 *   status: string,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} User
 */

const USER_TRANSITIONS = {
    ACTIVE: ['LOCKED', 'DISABLED'],
    LOCKED: ['ACTIVE', 'DISABLED'],
    DISABLED: [],
};

/**
 * @param {User} props
 * @returns {User}
 */
export function reconstituteUser(props) {
    return {
        id: props.id,
        email: props.email,
        status: props.status,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {string} id
 * @param {EmailValue} email
 * @returns {User}
 */
export function createUserEntity(id, email) {
    const now = new Date();
    return reconstituteUser({
        id,
        email,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
    });
}

/**
 * @param {User} user
 * @returns {boolean}
 */
export function canAuthenticate(user) {
    return user.status === 'ACTIVE';
}

/**
 * @param {User} user
 * @param {string} nextStatus
 * @returns {User}
 */
export function transitionUserStatus(user, nextStatus) {
    if (user.status === nextStatus) {
        return user;
    }
    const allowed = USER_TRANSITIONS[user.status];
    if (!allowed.includes(nextStatus)) {
        throw new BusinessRuleError(`User status cannot transition from ${user.status} to ${nextStatus}`);
    }
    return reconstituteUser({
        ...user,
        status: nextStatus,
        updatedAt: new Date(),
    });
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransitionUserStatus(from, to) {
    if (from === to) {
        return true;
    }
    return USER_TRANSITIONS[from].includes(to);
}
