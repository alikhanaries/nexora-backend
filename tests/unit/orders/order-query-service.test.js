import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError, NotFoundError, ValidationError } from '../../../src/shared/errors/index.js';
import { createOrderQueryService } from '../../../src/modules/orders/services/order-query-service.js';

function createAuth(requirePermissionImpl) {
  return {
    requirePermission: requirePermissionImpl ?? vi.fn(),
  };
}

describe('createOrderQueryService', () => {
  it('getOrderById returns order DTO', async () => {
    const order = { id: 'o1', tenantId: 't1', status: 'NEW', orderNumber: '100' };
    const service = createOrderQueryService({
      authorization: createAuth(),
      queryable: {},
      orders: {
        findById: vi.fn(async () => order),
      },
    });

    const dto = await service.getOrderById('t1', 'o1');
    expect(dto.id).toBe('o1');
  });

  it('getOrderById throws NotFoundError when missing', async () => {
    const service = createOrderQueryService({
      authorization: createAuth(),
      queryable: {},
      orders: { findById: vi.fn(async () => null) },
    });

    await expect(service.getOrderById('t1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('findOrderById returns null when missing', async () => {
    const service = createOrderQueryService({
      authorization: createAuth(),
      queryable: {},
      orders: { findById: vi.fn(async () => null) },
    });

    await expect(service.findOrderById('t1', 'missing')).resolves.toBeNull();
  });

  it('getOrderLines maps line DTOs', async () => {
    const service = createOrderQueryService({
      authorization: createAuth(),
      queryable: {},
      orders: {
        listOrderLines: vi.fn(async () => [{ id: 'l1', productId: 'p1', quantity: 2 }]),
      },
    });

    const lines = await service.getOrderLines('t1', 'o1');
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe('l1');
  });

  it('verifyOrderBelongsToTenant delegates to getOrderById', async () => {
    const order = { id: 'o1', tenantId: 't1', status: 'NEW' };
    const service = createOrderQueryService({
      authorization: createAuth(),
      queryable: {},
      orders: { findById: vi.fn(async () => order) },
    });

    const dto = await service.verifyOrderBelongsToTenant('t1', 'o1');
    expect(dto.id).toBe('o1');
  });

  it('listOrders enforces orders:read and returns page envelope', async () => {
    const requirePermission = vi.fn((permissions, permission) => {
      if (!permissions.includes(permission)) {
        throw new AuthorizationError(`Missing required permission: ${permission}`);
      }
    });
    const order = { id: 'o1', tenantId: 't1', status: 'NEW' };
    const service = createOrderQueryService({
      authorization: createAuth(requirePermission),
      queryable: {},
      orders: {
        count: vi.fn(async () => 1),
        listPage: vi.fn(async () => [order]),
        listOrderLines: vi.fn(async () => []),
        findCustomerSnapshot: vi.fn(async () => null),
      },
    });

    const page = await service.listOrders({
      tenantId: 't1',
      actorPermissions: ['orders.read'],
      page: 1,
      pageSize: 10,
    });

    expect(page.totalCount).toBe(1);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(10);
    expect(page.items).toHaveLength(1);
  });

  it('listOrders rejects invalid page size', async () => {
    const service = createOrderQueryService({
      authorization: createAuth(),
      queryable: {},
      orders: {},
    });

    await expect(
      service.listOrders({
        tenantId: 't1',
        actorPermissions: ['orders.read'],
        pageSize: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('DefaultOrderQueryService constructor returns same API as factory', async () => {
    const { DefaultOrderQueryService } = await import(
      '../../../src/modules/orders/services/order-query-service.js'
    );
    const order = { id: 'o1', tenantId: 't1', status: 'NEW' };
    const service = new DefaultOrderQueryService({
      authorization: createAuth(),
      queryable: {},
      orders: { findById: vi.fn(async () => order) },
    });

    const dto = await service.findOrderById('t1', 'o1');
    expect(dto.id).toBe('o1');
  });
});
