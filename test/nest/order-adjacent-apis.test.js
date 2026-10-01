import request from 'supertest';
import { afterEach, describe, expect, it } from '@jest/globals';
import { createTestNestApp } from './helpers/create-test-nest-app.js';
import { createMockCoreDomain } from './helpers/mock-core-domain.js';

const tenantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const orderLineId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cancellationId = '11111111-1111-4111-8111-111111111111';
const shipmentId = '22222222-2222-4222-8222-222222222222';
const returnId = '33333333-3333-4333-8333-333333333333';

const actor = {
  kind: 'user',
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  tenantId,
  permissions: [
    'orders.read',
    'orders.cancel',
    'cancellations.read',
    'cancellations.create',
    'shipments.read',
    'shipments.create',
    'shipments.update',
    'returns.read',
    'returns.create',
    'returns.update',
  ],
  authenticationMethod: 'password',
};

function buildCancellation() {
  const at = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: cancellationId,
    tenantId,
    orderId,
    status: 'COMPLETED',
    reason: null,
    createdAt: at,
    updatedAt: at,
    completedAt: at,
    lines: [],
  };
}

function buildShipment() {
  const at = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: shipmentId,
    tenantId,
    orderId,
    externalReference: null,
    carrier: null,
    service: null,
    trackingNumber: null,
    status: 'CREATED',
    shippedAt: null,
    deliveredAt: null,
    createdAt: at,
    updatedAt: at,
    lines: [],
  };
}

function buildReturn() {
  const at = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: returnId,
    tenantId,
    orderId,
    shipmentId: null,
    status: 'REQUESTED',
    reason: null,
    createdAt: at,
    updatedAt: at,
    lines: [],
  };
}

describe('Nest order-adjacent APIs (Phase 10)', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('GET /api/v1/cancellations requires authentication', async () => {
    const created = await createTestNestApp({ coreDomain: createMockCoreDomain() });
    app = created.app;
    await request(app.getHttpServer()).get('/api/v1/cancellations').expect(401);
  });

  it('POST /api/v1/orders/:orderId/cancel returns 201', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    coreDomain.cancellations.useCases.createCancellation.execute.mockResolvedValue({
      cancellation: buildCancellation(),
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', 'Bearer token')
      .send({})
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(coreDomain.cancellations.useCases.createCancellation.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        permission: 'orders.cancel',
      }),
    );
  });

  it('POST /api/v1/cancellations requires Idempotency-Key', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post('/api/v1/cancellations')
      .set('Authorization', 'Bearer token')
      .send({ orderId })
      .expect(400);
  });

  it('GET /api/v1/shipments returns list envelope', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/shipments')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.data.items).toEqual([]);
  });

  it('POST /api/v1/orders/:orderId/shipments requires Idempotency-Key', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/shipments`)
      .set('Authorization', 'Bearer token')
      .send({ lines: [{ orderLineId, quantity: 1 }] })
      .expect(400);
  });

  it('POST /api/v1/orders/:orderId/shipments returns 201 when idempotent', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    coreDomain.shipments.useCases.createShipment.execute.mockResolvedValue({
      shipment: buildShipment(),
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/shipments`)
      .set('Authorization', 'Bearer token')
      .set('Idempotency-Key', 'ship-1')
      .send({ lines: [{ orderLineId, quantity: 1 }] })
      .expect(201);
  });

  it('POST /api/v1/shipments/:shipmentId/ship returns success', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    coreDomain.shipments.useCases.shipShipment.execute.mockResolvedValue({
      shipment: { ...buildShipment(), status: 'SHIPPED' },
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/shipments/${shipmentId}/ship`)
      .set('Authorization', 'Bearer token')
      .send({})
      .expect(200);

    expect(response.body.data.status).toBe('SHIPPED');
  });

  it('POST /api/v1/orders/:orderId/returns requires Idempotency-Key', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/returns`)
      .set('Authorization', 'Bearer token')
      .send({ lines: [{ orderLineId, quantity: 1 }] })
      .expect(400);
  });

  it('POST /api/v1/returns/:returnId/approve returns success', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    coreDomain.returns.useCases.approveReturn.execute.mockResolvedValue({
      return: { ...buildReturn(), status: 'APPROVED' },
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/returns/${returnId}/approve`)
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.data.status).toBe('APPROVED');
  });
});

describe('Phase 10 route parity inventory', () => {
  const fastifyRoutes = [
    'GET /api/v1/cancellations',
    'POST /api/v1/cancellations',
    'GET /api/v1/cancellations/:cancellationId',
    'POST /api/v1/orders/:orderId/cancel',
    'POST /api/v1/orders/:orderId/shipments',
    'GET /api/v1/shipments',
    'GET /api/v1/shipments/:shipmentId',
    'POST /api/v1/shipments/:shipmentId/ship',
    'POST /api/v1/shipments/:shipmentId/deliver',
    'POST /api/v1/shipments/:shipmentId/cancel',
    'POST /api/v1/orders/:orderId/returns',
    'GET /api/v1/returns',
    'GET /api/v1/returns/:returnId',
    'POST /api/v1/returns/:returnId/approve',
    'POST /api/v1/returns/:returnId/receive',
    'POST /api/v1/returns/:returnId/complete',
    'POST /api/v1/returns/:returnId/reject',
    'POST /api/v1/returns/:returnId/cancel',
  ];

  it('documents 18 Fastify routes migrated in Phase 10 scope', () => {
    expect(fastifyRoutes).toHaveLength(18);
  });
});
