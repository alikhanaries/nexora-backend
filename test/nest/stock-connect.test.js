import request from 'supertest';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { AuthenticationError } from '../../src/shared/errors/index.js';
import { createTestNestApp } from './helpers/create-test-nest-app.js';
import { createMockCoreDomain } from './helpers/mock-core-domain.js';

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL_ID = '22222222-2222-4222-8222-222222222222';
const LOCATION_ID = '33333333-3333-4333-8333-333333333333';
const ORDER_ID = '44444444-4444-4444-8444-444444444444';
const LINE_ID = '55555555-5555-4555-8555-555555555555';
const SHIPMENT_ID = '66666666-6666-4666-8666-666666666666';
const API_KEY = 'nxk_testhttp.abcdefghijklmnopqrstuvwxyz012345';
const NOW = new Date('2026-01-15T12:00:00.000Z');

const scPermissions = [
  'products.read',
  'products.write',
  'channels.read',
  'inventory.read',
  'inventory.adjust',
  'orders.read',
  'orders.cancel',
  'shipments.read',
  'shipments.write',
  'offers.read',
  'offers.write',
];

function apiKeyPrincipal(tenantId = TENANT_A, permissions = scPermissions) {
  return {
    apiKeyId: 'key-sc-1',
    tenantId,
    permissions,
    scopes: permissions,
  };
}

function productEntity(overrides = {}) {
  return {
    id: PRODUCT_ID,
    tenantId: TENANT_A,
    merchantSku: 'SC-SKU-001',
    externalReference: null,
    productType: 'STANDARD',
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function channelEntity() {
  return {
    id: CHANNEL_ID,
    tenantId: TENANT_A,
    marketplaceId: '77777777-7777-4777-8777-777777777777',
    name: 'SC Channel',
    externalReference: null,
    status: 'ACTIVE',
    configurationReference: null,
    defaultStockLocationId: LOCATION_ID,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function orderEntity() {
  return {
    id: ORDER_ID,
    tenantId: TENANT_A,
    channelId: CHANNEL_ID,
    externalOrderReference: 'EXT-100',
    orderNumber: 'ORD-100',
    status: 'CONFIRMED',
    currency: 'USD',
    subtotalMinor: 2500,
    discountMinor: 0,
    taxMinor: 0,
    shippingMinor: 0,
    totalMinor: 2500,
    createdAt: NOW,
    updatedAt: NOW,
    confirmedAt: NOW,
    cancelledAt: null,
    shippedAt: null,
    deliveredAt: null,
    lines: [
      {
        id: LINE_ID,
        productId: PRODUCT_ID,
        offerId: null,
        stockLocationId: LOCATION_ID,
        merchantSku: 'SC-SKU-001',
        productTypeSnapshot: 'STANDARD',
        quantity: 2,
        cancelledQuantity: 0,
        shippedQuantity: 0,
        returnedQuantity: 0,
        unitPriceMinor: 1250,
        discountMinor: 0,
        taxMinor: 0,
        lineTotalMinor: 2500,
        currency: 'USD',
        status: 'OPEN',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    customer: null,
  };
}

function shipmentEntity(status = 'CREATED') {
  return {
    id: SHIPMENT_ID,
    tenantId: TENANT_A,
    orderId: ORDER_ID,
    externalReference: null,
    carrier: 'DHL',
    service: 'EXPRESS',
    trackingNumber: 'TRACK-1',
    status,
    shippedAt: status === 'SHIPPED' ? NOW : null,
    deliveredAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    lines: [
      {
        id: '88888888-8888-4888-8888-888888888888',
        tenantId: TENANT_A,
        shipmentId: SHIPMENT_ID,
        orderLineId: LINE_ID,
        quantity: 2,
        createdAt: NOW,
      },
    ],
  };
}

function wireStockConnectMocks(coreDomain) {
  coreDomain.authorization = {
    ...coreDomain.authorization,
    authorizationService: {
      requirePermission: jest.fn(),
    },
  };
  coreDomain.products.productQueryService = {
    getProductBySku: jest.fn().mockResolvedValue(productEntity()),
  };
  coreDomain.orders.orderQueryService = {
    getOrderLines: jest.fn().mockResolvedValue(orderEntity().lines),
    listOrders: jest.fn().mockResolvedValue({
      items: [orderEntity()],
      page: 1,
      pageSize: 50,
      totalCount: 1,
    }),
  };
  coreDomain.channelRouteDeps.listChannels.execute.mockResolvedValue({
    channels: [channelEntity()],
  });
  coreDomain.products.useCases.listProducts.execute.mockResolvedValue({
    items: [productEntity()],
    nextCursor: null,
    hasMore: false,
  });
  coreDomain.products.useCases.createProduct.execute.mockResolvedValue({
    product: productEntity(),
  });
  coreDomain.products.useCases.getProduct.execute.mockResolvedValue({
    product: productEntity(),
  });
  coreDomain.products.useCases.updateProduct.execute.mockResolvedValue({
    product: productEntity({ externalReference: 'sc-ext' }),
  });
  coreDomain.offers.useCases.listOffers.execute.mockResolvedValue({
    items: [],
    nextCursor: null,
    hasMore: false,
  });
  coreDomain.offers.useCases.createOffer.execute.mockResolvedValue({
    offer: {
      id: '99999999-9999-4999-8999-999999999999',
      tenantId: TENANT_A,
      productId: PRODUCT_ID,
      channelId: CHANNEL_ID,
      status: 'DRAFT',
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  coreDomain.offers.useCases.activateOffer.execute.mockResolvedValue({
    offer: {
      id: '99999999-9999-4999-8999-999999999999',
      tenantId: TENANT_A,
      productId: PRODUCT_ID,
      channelId: CHANNEL_ID,
      status: 'ACTIVE',
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  coreDomain.inventory.useCases.getInventory.execute.mockResolvedValue({
    balances: [
      {
        id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
        tenantId: TENANT_A,
        stockLocationId: LOCATION_ID,
        productId: PRODUCT_ID,
        onHand: 10,
        reserved: 2,
        available: 8,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  });
  coreDomain.inventory.useCases.adjustInventory.execute.mockResolvedValue({
    idempotent: false,
    balance: { onHand: 12, reserved: 2, available: 10 },
  });
  coreDomain.orders.useCases.listOrders.execute.mockResolvedValue({
    items: [orderEntity()],
    nextCursor: null,
    hasMore: false,
  });
  coreDomain.orders.useCases.getOrder.execute.mockResolvedValue({
    order: orderEntity(),
  });
  coreDomain.cancellations.useCases.createCancellation.execute.mockResolvedValue({
    cancellation: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'COMPLETED' },
  });
  coreDomain.shipments.useCases.createShipment.execute.mockResolvedValue({
    shipment: shipmentEntity('CREATED'),
  });
  coreDomain.shipments.useCases.getShipment.execute.mockResolvedValue({
    shipment: shipmentEntity('CREATED'),
  });
  coreDomain.shipments.useCases.shipShipment.execute.mockResolvedValue({
    shipment: shipmentEntity('SHIPPED'),
  });
}

describe('StockConnect ERP adapter HTTP contract', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  describe('authentication', () => {
    it('GET ping is public and returns stock-connect envelope', async () => {
      const created = await createTestNestApp({ coreDomain: createMockCoreDomain() });
      app = created.app;
      const response = await request(app.getHttpServer())
        .get('/api/v2/stock-connect/ping')
        .expect(200);
      expect(response.body).toEqual({
        success: true,
        integration: 'stock-connect',
        data: { message: 'pong' },
      });
    });

    it('rejects missing Authorization on channels', async () => {
      const created = await createTestNestApp({ coreDomain: createMockCoreDomain() });
      app = created.app;
      await request(app.getHttpServer()).get('/api/v2/stock-connect/channels').expect(401);
    });

    it('rejects invalid API key', async () => {
      const coreDomain = createMockCoreDomain();
      coreDomain.verifyApiKey.execute.mockRejectedValue(new AuthenticationError('Invalid API key'));
      const created = await createTestNestApp({ coreDomain });
      app = created.app;
      await request(app.getHttpServer())
        .get('/api/v2/stock-connect/channels')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(401);
    });

    it('rejects malformed Bearer token as JWT failure', async () => {
      const coreDomain = createMockCoreDomain();
      coreDomain.authenticateAccessToken.execute.mockRejectedValue(
        new AuthenticationError('Invalid token'),
      );
      const created = await createTestNestApp({ coreDomain });
      app = created.app;
      await request(app.getHttpServer())
        .get('/api/v2/stock-connect/channels')
        .set('Authorization', 'Bearer not-an-api-key')
        .expect(401);
      expect(coreDomain.verifyApiKey.execute).not.toHaveBeenCalled();
      expect(coreDomain.authenticateAccessToken.execute).toHaveBeenCalled();
    });

    it('authenticates Bearer nxk_ via verifyApiKey', async () => {
      const coreDomain = createMockCoreDomain();
      wireStockConnectMocks(coreDomain);
      coreDomain.verifyApiKey.execute.mockResolvedValue(apiKeyPrincipal());
      const created = await createTestNestApp({ coreDomain });
      app = created.app;

      const response = await request(app.getHttpServer())
        .get('/api/v2/stock-connect/channels')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);

      expect(coreDomain.verifyApiKey.execute).toHaveBeenCalledWith({ rawKey: API_KEY });
      expect(coreDomain.authenticateAccessToken.execute).not.toHaveBeenCalled();
      expect(response.body.success).toBe(true);
      expect(response.body.integration).toBe('stock-connect');
      expect(response.body.data.items).toHaveLength(1);
    });

    it('rejects mismatched X-Tenant-Id', async () => {
      const coreDomain = createMockCoreDomain();
      coreDomain.verifyApiKey.execute.mockResolvedValue(apiKeyPrincipal(TENANT_A));
      const created = await createTestNestApp({ coreDomain });
      app = created.app;

      const response = await request(app.getHttpServer())
        .get('/api/v2/stock-connect/channels')
        .set('Authorization', `Bearer ${API_KEY}`)
        .set('X-Tenant-Id', TENANT_B)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain(API_KEY);
    });

    it('accepts matching X-Tenant-Id', async () => {
      const coreDomain = createMockCoreDomain();
      wireStockConnectMocks(coreDomain);
      coreDomain.verifyApiKey.execute.mockResolvedValue(apiKeyPrincipal(TENANT_A));
      const created = await createTestNestApp({ coreDomain });
      app = created.app;

      await request(app.getHttpServer())
        .get('/api/v2/stock-connect/channels')
        .set('Authorization', `Bearer ${API_KEY}`)
        .set('X-Tenant-Id', TENANT_A)
        .expect(200);
    });

    it('keeps JWT bearer path for non-nxk tokens', async () => {
      const coreDomain = createMockCoreDomain();
      wireStockConnectMocks(coreDomain);
      coreDomain.authenticateAccessToken.execute.mockResolvedValue({
        kind: 'user',
        id: 'user-1',
        tenantId: TENANT_A,
        permissions: scPermissions,
        authenticationMethod: 'password',
      });
      const created = await createTestNestApp({ coreDomain });
      app = created.app;

      await request(app.getHttpServer())
        .get('/api/v2/stock-connect/channels')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig')
        .expect(200);

      expect(coreDomain.authenticateAccessToken.execute).toHaveBeenCalled();
      expect(coreDomain.verifyApiKey.execute).not.toHaveBeenCalled();
    });
  });

  describe('products / channels / inventory', () => {
    async function authedApp() {
      const coreDomain = createMockCoreDomain();
      wireStockConnectMocks(coreDomain);
      coreDomain.verifyApiKey.execute.mockResolvedValue(apiKeyPrincipal());
      const created = await createTestNestApp({ coreDomain });
      app = created.app;
      return coreDomain;
    }

    it('lists products and filters by merchantSku', async () => {
      const coreDomain = await authedApp();
      const list = await request(app.getHttpServer())
        .get('/api/v2/stock-connect/products')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);
      expect(list.body.data.items[0].merchantSku).toBe('SC-SKU-001');

      const bySku = await request(app.getHttpServer())
        .get('/api/v2/stock-connect/products?merchantSku=SC-SKU-001')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);
      expect(coreDomain.products.productQueryService.getProductBySku).toHaveBeenCalledWith(
        TENANT_A,
        'SC-SKU-001',
      );
      expect(bySku.body.data.items).toHaveLength(1);
    });

    it('creates, gets, patches, and publishes a product', async () => {
      const coreDomain = await authedApp();

      const createdProduct = await request(app.getHttpServer())
        .post('/api/v2/stock-connect/products')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ merchantSku: 'SC-SKU-001' })
        .expect(201);
      expect(createdProduct.body.integration).toBe('stock-connect');
      expect(coreDomain.products.useCases.createProduct.execute).toHaveBeenCalled();

      await request(app.getHttpServer())
        .get(`/api/v2/stock-connect/products/${PRODUCT_ID}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v2/stock-connect/products/${PRODUCT_ID}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ externalReference: 'sc-ext' })
        .expect(200);

      const published = await request(app.getHttpServer())
        .post(`/api/v2/stock-connect/products/${PRODUCT_ID}/publish`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ channelId: CHANNEL_ID })
        .expect(200);
      expect(published.body.data.offer.status).toBe('ACTIVE');
    });

    it('rejects invalid product create body', async () => {
      await authedApp();
      await request(app.getHttpServer())
        .post('/api/v2/stock-connect/products')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({})
        .expect(400);
    });

    it('reads inventory and applies adjustments', async () => {
      const coreDomain = await authedApp();
      const inv = await request(app.getHttpServer())
        .get(`/api/v2/stock-connect/inventory/${PRODUCT_ID}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);
      expect(inv.body.data.available).toBe(8);
      expect(inv.body.data.merchantSku).toBe('SC-SKU-001');

      await request(app.getHttpServer())
        .post('/api/v2/stock-connect/inventory/adjustments')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          productId: PRODUCT_ID,
          stockLocationId: LOCATION_ID,
          quantityDelta: 2,
        })
        .expect(200);
      expect(coreDomain.inventory.useCases.adjustInventory.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          productId: PRODUCT_ID,
          stockLocationId: LOCATION_ID,
          delta: 2,
        }),
      );
    });
  });

  describe('orders / shipments', () => {
    async function authedApp() {
      const coreDomain = createMockCoreDomain();
      wireStockConnectMocks(coreDomain);
      coreDomain.verifyApiKey.execute.mockResolvedValue(apiKeyPrincipal());
      const created = await createTestNestApp({ coreDomain });
      app = created.app;
      return coreDomain;
    }

    it('lists, syncs, details, and cancels orders', async () => {
      const coreDomain = await authedApp();

      const list = await request(app.getHttpServer())
        .get('/api/v2/stock-connect/orders?limit=10')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);
      expect(list.body.data.items[0].merchantOrderNo).toBe('ORD-100');
      expect(list.body.data.items[0].lines[0].merchantSku).toBe('SC-SKU-001');

      const sync = await request(app.getHttpServer())
        .get('/api/v2/stock-connect/orders/sync?limit=50')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);
      expect(coreDomain.orders.orderQueryService.listOrders).toHaveBeenCalled();
      expect(sync.body.data.items).toHaveLength(1);

      const detail = await request(app.getHttpServer())
        .get(`/api/v2/stock-connect/orders/${ORDER_ID}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);
      expect(detail.body.data.externalOrderId).toBe('EXT-100');

      const cancel = await request(app.getHttpServer())
        .post(`/api/v2/stock-connect/orders/${ORDER_ID}/cancel`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ reason: 'customer request' })
        .expect(200);
      expect(coreDomain.cancellations.useCases.createCancellation.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          orderId: ORDER_ID,
          permission: 'orders.cancel',
        }),
      );
      expect(cancel.body.data.cancellationId).toBeTruthy();
    });

    it('creates, gets, and ships shipments', async () => {
      const coreDomain = await authedApp();

      const createdShipment = await request(app.getHttpServer())
        .post(`/api/v2/stock-connect/orders/${ORDER_ID}/shipments`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .set('Idempotency-Key', 'sc-ship-test-1')
        .send({
          carrier: 'DHL',
          trackingNumber: 'TRACK-1',
          lines: [{ orderLineId: LINE_ID, quantity: 2 }],
        })
        .expect(201);
      expect(createdShipment.body.data.id).toBe(SHIPMENT_ID);
      expect(coreDomain.shipments.useCases.createShipment.execute).toHaveBeenCalled();

      await request(app.getHttpServer())
        .get(`/api/v2/stock-connect/shipments/${SHIPMENT_ID}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);

      const shipped = await request(app.getHttpServer())
        .post(`/api/v2/stock-connect/shipments/${SHIPMENT_ID}/ship`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ trackingNumber: 'TRACK-1' })
        .expect(200);
      expect(shipped.body.data.status).toBe('SHIPPED');
      expect(coreDomain.shipments.useCases.shipShipment.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          shipmentId: SHIPMENT_ID,
        }),
      );
    });
  });
});
