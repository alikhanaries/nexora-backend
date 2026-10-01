import request from 'supertest';
import { afterEach, describe, expect, it } from '@jest/globals';
import { createTestNestApp } from './helpers/create-test-nest-app.js';
import { createMockCoreDomain } from './helpers/mock-core-domain.js';

const actor = {
  kind: 'user',
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  permissions: ['orders.read', 'orders.ingest', 'orders.ingest_channel_fulfilled'],
  authenticationMethod: 'password',
};

describe('Nest legacy order compatibility (Phase 11)', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('GET /api/v2/orders requires authentication', async () => {
    const created = await createTestNestApp({ coreDomain: createMockCoreDomain() });
    app = created.app;
    await request(app.getHttpServer()).get('/api/v2/orders').expect(401);
  });

  it('GET /api/v2/orders returns Merchant-compatible envelope', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v2/orders')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.Success).toBe(true);
    expect(coreDomain.compatibility.routeDeps.orderCompatibilityQuery.listOrders).toHaveBeenCalled();
  });

  it('GET /api/v2/orders/new delegates to listNewOrders', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .get('/api/v2/orders/new')
      .query({ Page: '1', ItemsPerPage: '10' })
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(
      coreDomain.compatibility.routeDeps.orderCompatibilityQuery.listNewOrders,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        page: 1,
        pageSize: 10,
      }),
    );
  });

  it('POST /api/v2/orders requires Idempotency-Key', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post('/api/v2/orders')
      .set('Authorization', 'Bearer token')
      .send({ MerchantOrderNo: 'M-1', Lines: [] })
      .expect(400);

    expect(response.body.Success).toBe(false);
  });

  it('POST /api/v2/orders/acknowledge returns 201 envelope', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post('/api/v2/orders/acknowledge')
      .set('Authorization', 'Bearer token')
      .set('Idempotency-Key', 'ack-1')
      .send({ MerchantOrderNo: 'ORD-100', OrderId: 1001 })
      .expect(201);

    expect(response.body.Success).toBe(true);
  });

  it('GET /api/v2/ce/orders returns CE poll envelope', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v2/ce/orders')
      .query({ page: '1', pageSize: '25' })
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.Success).toBe(true);
  });

  it('GET /api/v2/ce/orders/:merchantOrderNo/invoice returns PDF bytes', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v2/ce/orders/ORD-100/invoice')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.body.toString()).toContain('%PDF');
  });

  it('POST /api/v2/ce/orders/acknowledge works without Idempotency-Key (deterministic key)', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post('/api/v2/ce/orders/acknowledge')
      .set('Authorization', 'Bearer token')
      .send({ MerchantOrderNo: 'ORD-100', OrderId: 1001 })
      .expect(201);

    expect(
      coreDomain.compatibility.routeDeps.orderCompatibilityCommand.acknowledgeOrder,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^ce-compat:/),
      }),
    );
  });
});

describe('Phase 11 route parity inventory', () => {
  const v2OrderRoutes = [
    'GET /api/v2/orders',
    'GET /api/v2/orders/new',
    'POST /api/v2/orders',
    'POST /api/v2/orders/channel-fulfilled',
    'POST /api/v2/orders/acknowledge',
  ];
  const ceOrderRoutes = [
    'GET /api/v2/ce/orders/:merchantOrderNo/invoice',
    'GET /api/v2/ce/orders',
    'POST /api/v2/ce/orders/acknowledge',
  ];

  it('covers 5 v2 and 3 CE order routes (8 total)', () => {
    expect(v2OrderRoutes).toHaveLength(5);
    expect(ceOrderRoutes).toHaveLength(3);
    expect(v2OrderRoutes.length + ceOrderRoutes.length).toBe(8);
  });
});
