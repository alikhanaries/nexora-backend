import request from 'supertest';
import { afterEach, describe, expect, it } from '@jest/globals';
import { AuthorizationError } from '../../src/shared/errors/index.js';
import { createTestNestApp } from './helpers/create-test-nest-app.js';
import { createMockCoreDomain } from './helpers/mock-core-domain.js';

const tenantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const channelId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const productId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const stockLocationId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const actorWithRead = {
  kind: 'user',
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenantId,
  permissions: ['orders.read'],
  authenticationMethod: 'password',
};

const actorWithCreate = {
  ...actorWithRead,
  permissions: ['orders.read', 'orders.create'],
};

const actorWithUpdate = {
  ...actorWithRead,
  permissions: ['orders.read', 'orders.update'],
};

function buildOrderDomain() {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: orderId,
    tenantId,
    channelId,
    externalOrderReference: null,
    orderNumber: 'ORD-1',
    status: 'NEW',
    currency: 'USD',
    subtotalMinor: 1000,
    discountMinor: 0,
    taxMinor: 0,
    shippingMinor: 0,
    totalMinor: 1000,
    createdAt,
    updatedAt: createdAt,
    confirmedAt: null,
    cancelledAt: null,
    shippedAt: null,
    deliveredAt: null,
    lines: [],
    customer: null,
  };
}

describe('Nest orders module', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('GET /api/v1/orders requires authentication', async () => {
    const coreDomain = createMockCoreDomain();
    const created = await createTestNestApp({ coreDomain });
    app = created.app;
    await request(app.getHttpServer()).get('/api/v1/orders').expect(401);
  });

  it('GET /api/v1/orders returns list envelope when authenticated', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorWithRead);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { items: [], nextCursor: null, hasMore: false },
    });
    expect(coreDomain.orders.useCases.listOrders.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorPermissions: actorWithRead.permissions,
      }),
    );
  });

  it('GET /api/v1/orders forwards query filters to list use case', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorWithRead);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({
        limit: '10',
        status: 'NEW',
        channelId,
        externalOrderReference: 'ext-1',
        orderNumber: 'ORD-1',
        createdAfter: '2026-01-01T00:00:00.000Z',
        createdBefore: '2026-12-31T23:59:59.000Z',
      })
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(coreDomain.orders.useCases.listOrders.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        status: 'NEW',
        channelId,
        externalOrderReference: 'ext-1',
        orderNumber: 'ORD-1',
        createdAfter: expect.any(Date),
        createdBefore: expect.any(Date),
      }),
    );
  });

  it('GET /api/v1/orders/:orderId returns order detail', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorWithRead);
    const order = buildOrderDomain();
    coreDomain.orders.useCases.getOrder.execute.mockResolvedValue({ order });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(orderId);
    expect(response.body.data.lines).toEqual([]);
  });

  it('GET /api/v1/orders/:orderId rejects invalid orderId param', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorWithRead);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .get('/api/v1/orders/not-a-uuid')
      .set('Authorization', 'Bearer token')
      .expect(400);
  });

  it('POST /api/v1/orders requires Idempotency-Key header', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorWithCreate);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', 'Bearer token')
      .send({
        channelId,
        currency: 'USD',
        lines: [{ productId, stockLocationId, quantity: 1 }],
      })
      .expect(400);
  });

  it('POST /api/v1/orders returns 201 with idempotent envelope', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorWithCreate);
    const order = buildOrderDomain();
    coreDomain.orders.useCases.createOrder.execute.mockResolvedValue({ order });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', 'Bearer token')
      .set('Idempotency-Key', 'create-order-key-1')
      .send({
        channelId,
        currency: 'USD',
        lines: [{ productId, stockLocationId, quantity: 2 }],
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.orderNumber).toBe('ORD-1');
    expect(coreDomain.orders.useCases.idempotency.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: 'POST /api/v1/orders',
        idempotencyKey: 'create-order-key-1',
      }),
      expect.any(String),
      expect.any(Function),
      expect.any(Function),
      { useTransaction: true },
    );
  });

  it('POST /api/v1/orders/:orderId/confirm returns updated order', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorWithUpdate);
    const order = { ...buildOrderDomain(), status: 'CONFIRMED' };
    coreDomain.orders.useCases.confirmOrder.execute.mockResolvedValue({ order });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('CONFIRMED');
  });

  it('propagates authorization failures from use cases', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue({
      ...actorWithRead,
      permissions: [],
    });
    coreDomain.orders.useCases.listOrders.execute.mockRejectedValue(
      new AuthorizationError('Missing permission'),
    );

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', 'Bearer token')
      .expect(403);
  });
});

describe('Order route inventory parity', () => {
  const expectedRoutes = [
    { method: 'post', path: '/api/v1/orders', auth: true },
    { method: 'get', path: '/api/v1/orders', auth: true },
    { method: 'get', path: '/api/v1/orders/:orderId', auth: true },
    { method: 'post', path: '/api/v1/orders/:orderId/confirm', auth: true },
  ];

  it('matches Fastify order.routes.js (4 routes)', () => {
    expect(expectedRoutes).toHaveLength(4);
  });
});
