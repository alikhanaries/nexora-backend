import request from 'supertest';
import { afterEach, describe, expect, it } from '@jest/globals';
import { createTestNestApp } from './helpers/create-test-nest-app.js';
import { createMockCoreDomain } from './helpers/mock-core-domain.js';

const actor = {
  kind: 'user',
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  permissions: [
    'orders.read',
    'shipments.read',
    'shipments.write',
    'cancellations.read',
    'cancellations.write',
    'returns.read',
    'returns.write',
    'products.read',
    'products.write',
    'offers.write',
    'inventory.write',
  ],
  authenticationMethod: 'password',
};

const minimalShipmentBody = {
  MerchantShipmentNo: 'SHP-1',
  MerchantOrderNo: 'ORD-1',
  Lines: [{ MerchantProductNo: 'SKU-1', Quantity: 1 }],
};

const minimalCancellationBody = {
  MerchantCancellationNo: 'CAN-1',
  MerchantOrderNo: 'ORD-1',
  Lines: [{ MerchantProductNo: 'SKU-1', Quantity: 1 }],
};

const minimalReturnBody = {
  MerchantReturnNo: 'RET-1',
  MerchantOrderNo: 'ORD-1',
  Lines: [{ MerchantProductNo: 'SKU-1', Quantity: 1 }],
};

describe('Nest legacy compatibility (Phase 12)', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('GET /api/v2/foundation/ping requires authentication', async () => {
    const created = await createTestNestApp({ coreDomain: createMockCoreDomain() });
    app = created.app;
    await request(app.getHttpServer()).get('/api/v2/foundation/ping').expect(401);
  });

  it('GET /api/v2/foundation/ping returns v2 liveness envelope', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v2/foundation/ping')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({ message: 'pong', apiVersion: 'v2' });
  });

  it('GET /api/v2/shipments/merchant delegates to compatibility query', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v2/shipments/merchant')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.Success).toBe(true);
    expect(
      coreDomain.compatibility.routeDeps.shipmentCompatibilityQuery.listMerchantShipments,
    ).toHaveBeenCalled();
  });

  it('POST /api/v2/shipments requires Idempotency-Key', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post('/api/v2/shipments')
      .set('Authorization', 'Bearer token')
      .send(minimalShipmentBody)
      .expect(400);

    expect(response.body.Success).toBe(false);
  });

  it('POST /api/v2/shipments creates shipment with idempotency', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post('/api/v2/shipments')
      .set('Authorization', 'Bearer token')
      .set('Idempotency-Key', 'idem-shp-1')
      .send(minimalShipmentBody)
      .expect(201);

    expect(
      coreDomain.compatibility.routeDeps.shipmentCompatibilityCommand.createShipment,
    ).toHaveBeenCalled();
  });

  it('POST /api/v2/cancellations creates cancellation', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post('/api/v2/cancellations')
      .set('Authorization', 'Bearer token')
      .set('Idempotency-Key', 'idem-can-1')
      .send(minimalCancellationBody)
      .expect(201);
  });

  it('GET /api/v2/returns/merchant/new lists new returns', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .get('/api/v2/returns/merchant/new')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(
      coreDomain.compatibility.routeDeps.returnCompatibilityQuery.listNewMerchantReturns,
    ).toHaveBeenCalled();
  });

  it('GET /api/v2/products requires merchantProductNoList', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v2/products')
      .set('Authorization', 'Bearer token')
      .expect(400);

    expect(response.body.Success).toBe(false);
  });

  it('GET /api/v2/ce/channels accepts query apiKey auth', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.verifyApiKey.execute.mockResolvedValue({
      apiKeyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: actor.tenantId,
      permissions: actor.permissions,
      scopes: [],
    });
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .get('/api/v2/ce/channels')
      .query({ apiKey: 'ce-key-value' })
      .expect(200);

    expect(
      coreDomain.compatibility.routeDeps.stockConnectCeChannelCompatibilityQuery.listChannels,
    ).toHaveBeenCalledWith(expect.objectContaining({ tenantId: actor.tenantId }));
  });

  it('POST /api/v2/ce/shipments uses CE idempotency when header omitted', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.verifyApiKey.execute.mockResolvedValue({
      apiKeyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: actor.tenantId,
      permissions: actor.permissions,
      scopes: [],
    });
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post('/api/v2/ce/shipments')
      .query({ apiKey: 'ce-key-value' })
      .send(minimalShipmentBody)
      .expect(201);

    const call =
      coreDomain.compatibility.routeDeps.shipmentCompatibilityCommand.createShipment.mock
        .calls[0][0];
    expect(typeof call.idempotencyKey).toBe('string');
    expect(call.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('PUT /api/v2/ce/shipments/:merchantShipmentNo/delivery-state updates delivery', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.verifyApiKey.execute.mockResolvedValue({
      apiKeyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: actor.tenantId,
      permissions: actor.permissions,
      scopes: [],
    });
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .put('/api/v2/ce/shipments/SHP-1/delivery-state')
      .query({ apiKey: 'ce-key-value' })
      .send({ Status: 'DELIVERED' })
      .expect(200);

    expect(
      coreDomain.compatibility.routeDeps.stockConnectCeShipmentDeliveryCommand.updateDeliveryState,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ merchantShipmentNo: 'SHP-1', body: { Status: 'DELIVERED' } }),
    );
  });

  const v2ReadRoutes = [
    '/api/v2/cancellations/merchant',
    '/api/v2/returns/merchant',
  ];

  it.each(v2ReadRoutes)('GET %s requires authentication', async (path) => {
    const created = await createTestNestApp({ coreDomain: createMockCoreDomain() });
    app = created.app;
    await request(app.getHttpServer()).get(path).expect(401);
  });

  it('POST /api/v2/returns creates return', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actor);
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    await request(app.getHttpServer())
      .post('/api/v2/returns')
      .set('Authorization', 'Bearer token')
      .set('Idempotency-Key', 'idem-ret-1')
      .send(minimalReturnBody)
      .expect(201);
  });
});
