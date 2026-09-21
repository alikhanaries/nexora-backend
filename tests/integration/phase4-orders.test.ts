import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Application } from '../../src/app/bootstrap/create-application.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import type { HttpServer } from '../../src/app/http/types.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function seedCommerceFixture(
  server: HttpServer,
  headers: Record<string, string>,
): Promise<{
  channelId: string;
  productId: string;
  stockLocationId: string;
  offerId: string;
}> {
  const marketplaceRes = await server.inject({
    method: 'POST',
    url: '/api/v1/marketplaces',
    headers,
    payload: { key: `mp_${Date.now()}`, name: 'Order Test Marketplace' },
  });
  expect(marketplaceRes.statusCode).toBe(201);
  const marketplaceId = marketplaceRes.json().data.id as string;

  const channelRes = await server.inject({
    method: 'POST',
    url: '/api/v1/channels',
    headers,
    payload: { marketplaceId, name: 'Order Test Channel' },
  });
  expect(channelRes.statusCode).toBe(201);
  const channelId = channelRes.json().data.id as string;

  const productRes = await server.inject({
    method: 'POST',
    url: '/api/v1/products',
    headers,
    payload: { merchantSku: `SKU-${Date.now()}`, productType: 'STANDARD' },
  });
  expect(productRes.statusCode).toBe(201);
  const productId = productRes.json().data.id as string;

  const locationRes = await server.inject({
    method: 'POST',
    url: '/api/v1/stock-locations',
    headers,
    payload: { name: 'Order Test Warehouse' },
  });
  expect(locationRes.statusCode).toBe(201);
  const stockLocationId = locationRes.json().data.id as string;

  await server.inject({
    method: 'POST',
    url: '/api/v1/inventory/receipts',
    headers,
    payload: {
      stockLocationId,
      productId,
      quantity: 20,
      referenceType: 'TEST',
      referenceId: `receipt-${Date.now()}`,
    },
  });

  await server.inject({
    method: 'POST',
    url: '/api/v1/prices',
    headers,
    payload: {
      productId,
      channelId,
      currency: 'USD',
      amountMinor: 2500,
    },
  });

  const offerRes = await server.inject({
    method: 'POST',
    url: '/api/v1/offers',
    headers,
    payload: { productId, channelId },
  });
  expect(offerRes.statusCode).toBe(201);
  const offerId = offerRes.json().data.id as string;

  const activateRes = await server.inject({
    method: 'POST',
    url: `/api/v1/offers/${offerId}/activate`,
    headers,
    payload: { requirePricing: true },
  });
  expect(activateRes.statusCode).toBe(200);

  return { channelId, productId, stockLocationId, offerId };
}

describe('phase 4 orders integration', () => {
  let app: Application;
  let server: HttpServer;

  beforeAll(async () => {
    const infra = await getTestInfrastructure();
    app = await createApplication(infra);
    server = app.httpServer;
  });

  afterAll(async () => {
    await closeTestInfrastructure();
  });

  it('creates an order with customer snapshot and inventory reservation', async () => {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const headers = {
      ...authHeaders(user.accessToken),
      'idempotency-key': `order-create-${Date.now()}`,
    };

    const { channelId, productId, stockLocationId } = await seedCommerceFixture(server, headers);

    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers,
      payload: {
        channelId,
        currency: 'USD',
        lines: [{ productId, stockLocationId, quantity: 3 }],
        customer: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
        },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const order = createRes.json().data;
    expect(order.status).toBe('CONFIRMED');
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0].unitPriceMinor).toBe(2500);
    expect(order.lines[0].merchantSku).toBeTruthy();
    expect(order.customer?.firstName).toBe('Ada');

    const availabilityRes = await server.inject({
      method: 'GET',
      url: `/api/v1/inventory/${productId}`,
      headers: authHeaders(user.accessToken),
    });
    expect(availabilityRes.statusCode).toBe(200);
    const balances = availabilityRes.json().data as Array<{ reserved: number; available: number }>;
    expect(balances.some((b) => b.reserved === 3 && b.available === 17)).toBe(true);
  });

  it('replays order creation with the same idempotency key', async () => {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const idempotencyKey = `order-replay-${Date.now()}`;
    const headers = {
      ...authHeaders(user.accessToken),
      'idempotency-key': idempotencyKey,
    };

    const { channelId, productId, stockLocationId } = await seedCommerceFixture(server, headers);

    const payload = {
      channelId,
      currency: 'USD',
      lines: [{ productId, stockLocationId, quantity: 2 }],
    };

    const first = await server.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers,
      payload,
    });
    expect(first.statusCode).toBe(201);
    const firstId = first.json().data.id as string;

    const second = await server.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers,
      payload,
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().data.id).toBe(firstId);
  });

  it('rejects idempotency key reuse with a different payload', async () => {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const idempotencyKey = `order-conflict-${Date.now()}`;
    const headers = {
      ...authHeaders(user.accessToken),
      'idempotency-key': idempotencyKey,
    };

    const { channelId, productId, stockLocationId } = await seedCommerceFixture(server, headers);

    const first = await server.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers,
      payload: {
        channelId,
        currency: 'USD',
        lines: [{ productId, stockLocationId, quantity: 1 }],
      },
    });
    expect(first.statusCode).toBe(201);

    const second = await server.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers,
      payload: {
        channelId,
        currency: 'USD',
        lines: [{ productId, stockLocationId, quantity: 2 }],
      },
    });
    expect(second.statusCode).toBe(409);
  });

  it('requires Idempotency-Key for order creation', async () => {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const headers = authHeaders(user.accessToken);
    const { channelId, productId, stockLocationId } = await seedCommerceFixture(server, headers);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers,
      payload: {
        channelId,
        currency: 'USD',
        lines: [{ productId, stockLocationId, quantity: 1 }],
      },
    });
    expect(response.statusCode).toBe(400);
  });
});
