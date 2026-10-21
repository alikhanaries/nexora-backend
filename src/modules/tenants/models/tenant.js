import { BusinessRuleError } from '../../../shared/errors/index.js';
import { TenantStatus } from './tenant-status.js';

/**
 * @typedef {{
 *   id: string,
 *   slug: string,
 *   name: string,
 *   status: string,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} Tenant
 */

/**
 * @param {{ id: string, slug: string, name: string, createdAt: Date }} props
 * @returns {Tenant}
 */
export function createTenantEntity(props) {
    return {
        id: props.id,
        slug: props.slug,
        name: props.name,
        status: TenantStatus.ACTIVE,
        createdAt: props.createdAt,
        updatedAt: props.createdAt,
    };
}

/**
 * @param {Tenant} props
 * @returns {Tenant}
 */
export function reconstituteTenant(props) {
    return {
        id: props.id,
        slug: props.slug,
        name: props.name,
        status: props.status,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}

/**
 * @param {Tenant} tenant
 * @param {string} status
 * @param {Date} updatedAt
 * @returns {Tenant}
 */
function withStatus(tenant, status, updatedAt) {
    return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status,
        createdAt: tenant.createdAt,
        updatedAt,
    };
}

/**
 * @param {Tenant} tenant
 * @param {Date} at
 * @returns {Tenant}
 */
export function suspendTenantEntity(tenant, at) {
    if (tenant.status === TenantStatus.CLOSED) {
        throw new BusinessRuleError('Cannot suspend a closed tenant');
    }
    if (tenant.status === TenantStatus.SUSPENDED) {
        throw new BusinessRuleError('Tenant is already suspended');
    }
    return withStatus(tenant, TenantStatus.SUSPENDED, at);
}

/**
 * @param {Tenant} tenant
 * @param {Date} at
 * @returns {Tenant}
 */
export function reactivateTenantEntity(tenant, at) {
    if (tenant.status === TenantStatus.CLOSED) {
        throw new BusinessRuleError('Cannot reactivate a closed tenant');
    }
    if (tenant.status === TenantStatus.ACTIVE) {
        throw new BusinessRuleError('Tenant is already active');
    }
    return withStatus(tenant, TenantStatus.ACTIVE, at);
}

/**
 * @param {Tenant} tenant
 * @param {Date} at
 * @returns {Tenant}
 */
export function closeTenantEntity(tenant, at) {
    if (tenant.status === TenantStatus.CLOSED) {
        throw new BusinessRuleError('Tenant is already closed');
    }
    return withStatus(tenant, TenantStatus.CLOSED, at);
}
