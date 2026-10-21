import { describe, expect, it } from 'vitest';
import { BusinessRuleError } from '../../../src/shared/errors/index.js';
import {
    closeTenantEntity,
    createTenantEntity,
    reactivateTenantEntity,
    suspendTenantEntity,
} from '../../../src/modules/tenants/models/tenant.js';
import { TenantStatus } from '../../../src/modules/tenants/models/tenant-status.js';

const BASE_TIME = new Date('2026-01-01T00:00:00.000Z');
const LATER = new Date('2026-01-02T00:00:00.000Z');

function activeTenant() {
    return createTenantEntity({
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'acme',
        name: 'Acme Corp',
        createdAt: BASE_TIME,
    });
}

function suspendedTenant() {
    return suspendTenantEntity(activeTenant(), LATER);
}

function closedTenant() {
    return closeTenantEntity(activeTenant(), LATER);
}

describe('Tenant lifecycle', () => {
    it('creates tenants in ACTIVE status', () => {
        const tenant = activeTenant();
        expect(tenant.status).toBe(TenantStatus.ACTIVE);
    });
    it('suspends an active tenant', () => {
        const tenant = suspendTenantEntity(activeTenant(), LATER);
        expect(tenant.status).toBe(TenantStatus.SUSPENDED);
        expect(tenant.updatedAt).toEqual(LATER);
    });
    it('reactivates a suspended tenant', () => {
        const tenant = reactivateTenantEntity(suspendedTenant(), LATER);
        expect(tenant.status).toBe(TenantStatus.ACTIVE);
    });
    it('closes an active tenant', () => {
        const tenant = closeTenantEntity(activeTenant(), LATER);
        expect(tenant.status).toBe(TenantStatus.CLOSED);
    });
    it('closes a suspended tenant', () => {
        const tenant = closeTenantEntity(suspendedTenant(), LATER);
        expect(tenant.status).toBe(TenantStatus.CLOSED);
    });
    it('rejects suspending an already suspended tenant', () => {
        expect(() => suspendTenantEntity(suspendedTenant(), LATER)).toThrow(BusinessRuleError);
    });
    it('rejects suspending a closed tenant', () => {
        expect(() => suspendTenantEntity(closedTenant(), LATER)).toThrow(BusinessRuleError);
    });
    it('rejects reactivating an active tenant', () => {
        expect(() => reactivateTenantEntity(activeTenant(), LATER)).toThrow(BusinessRuleError);
    });
    it('rejects reactivating a closed tenant', () => {
        expect(() => reactivateTenantEntity(closedTenant(), LATER)).toThrow(BusinessRuleError);
    });
    it('rejects closing an already closed tenant', () => {
        expect(() => closeTenantEntity(closedTenant(), LATER)).toThrow(BusinessRuleError);
    });
});
