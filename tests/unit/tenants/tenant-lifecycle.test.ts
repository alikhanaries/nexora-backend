import { describe, expect, it } from 'vitest';
import { BusinessRuleError } from '../../../src/shared/errors/index.js';
import { Tenant } from '../../../src/modules/tenants/domain/tenant.js';
import { TenantStatus } from '../../../src/modules/tenants/domain/tenant-status.js';

const BASE_TIME = new Date('2026-01-01T00:00:00.000Z');
const LATER = new Date('2026-01-02T00:00:00.000Z');

function activeTenant(): Tenant {
  return Tenant.create({
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'acme',
    name: 'Acme Corp',
    createdAt: BASE_TIME,
  });
}

function suspendedTenant(): Tenant {
  return activeTenant().suspend(LATER);
}

function closedTenant(): Tenant {
  return activeTenant().close(LATER);
}

describe('Tenant lifecycle', () => {
  it('creates tenants in ACTIVE status', () => {
    const tenant = activeTenant();
    expect(tenant.status).toBe(TenantStatus.ACTIVE);
  });

  it('suspends an active tenant', () => {
    const tenant = activeTenant().suspend(LATER);
    expect(tenant.status).toBe(TenantStatus.SUSPENDED);
    expect(tenant.updatedAt).toEqual(LATER);
  });

  it('reactivates a suspended tenant', () => {
    const tenant = suspendedTenant().reactivate(LATER);
    expect(tenant.status).toBe(TenantStatus.ACTIVE);
  });

  it('closes an active tenant', () => {
    const tenant = activeTenant().close(LATER);
    expect(tenant.status).toBe(TenantStatus.CLOSED);
  });

  it('closes a suspended tenant', () => {
    const tenant = suspendedTenant().close(LATER);
    expect(tenant.status).toBe(TenantStatus.CLOSED);
  });

  it('rejects suspending an already suspended tenant', () => {
    expect(() => suspendedTenant().suspend(LATER)).toThrow(BusinessRuleError);
  });

  it('rejects suspending a closed tenant', () => {
    expect(() => closedTenant().suspend(LATER)).toThrow(BusinessRuleError);
  });

  it('rejects reactivating an active tenant', () => {
    expect(() => activeTenant().reactivate(LATER)).toThrow(BusinessRuleError);
  });

  it('rejects reactivating a closed tenant', () => {
    expect(() => closedTenant().reactivate(LATER)).toThrow(BusinessRuleError);
  });

  it('rejects closing an already closed tenant', () => {
    expect(() => closedTenant().close(LATER)).toThrow(BusinessRuleError);
  });
});
