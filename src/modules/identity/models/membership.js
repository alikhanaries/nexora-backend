import { BusinessRuleError } from '../../../shared/errors/index.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   userId: string,
 *   status: string,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} Membership
 */

const MEMBERSHIP_TRANSITIONS = {
    PENDING: ['ACTIVE', 'REVOKED'],
    ACTIVE: ['SUSPENDED', 'REVOKED'],
    SUSPENDED: ['ACTIVE', 'REVOKED'],
    REVOKED: [],
};

/**
 * @param {Membership} props
 * @returns {Membership}
 */
export function reconstituteMembership(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        userId: props.userId,
        status: props.status,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {string} id
 * @param {string} tenantId
 * @param {string} userId
 * @returns {Membership}
 */
export function createPendingMembershipEntity(id, tenantId, userId) {
    const now = new Date();
    return reconstituteMembership({
        id,
        tenantId,
        userId,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
    });
}

/**
 * @param {Membership} membership
 * @returns {boolean}
 */
export function membershipGrantsAccess(membership) {
    return membership.status === 'ACTIVE';
}

/**
 * @param {Membership} membership
 * @returns {boolean}
 */
export function isTerminalMembership(membership) {
    return membership.status === 'REVOKED';
}

/**
 * @param {Membership} membership
 * @param {string} nextStatus
 * @returns {Membership}
 */
export function transitionMembershipStatus(membership, nextStatus) {
    if (membership.status === nextStatus) {
        return membership;
    }
    const allowed = MEMBERSHIP_TRANSITIONS[membership.status];
    if (!allowed.includes(nextStatus)) {
        throw new BusinessRuleError(`Membership status cannot transition from ${membership.status} to ${nextStatus}`);
    }
    return reconstituteMembership({
        ...membership,
        status: nextStatus,
        updatedAt: new Date(),
    });
}

/**
 * @param {Membership} membership
 * @returns {Membership}
 */
export function activateMembershipEntity(membership) {
    return transitionMembershipStatus(membership, 'ACTIVE');
}

/**
 * @param {Membership} membership
 * @returns {Membership}
 */
export function suspendMembershipEntity(membership) {
    return transitionMembershipStatus(membership, 'SUSPENDED');
}

/**
 * @param {Membership} membership
 * @returns {Membership}
 */
export function revokeMembershipEntity(membership) {
    return transitionMembershipStatus(membership, 'REVOKED');
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransitionMembershipStatus(from, to) {
    if (from === to) {
        return true;
    }
    return MEMBERSHIP_TRANSITIONS[from].includes(to);
}
