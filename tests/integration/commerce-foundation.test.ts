import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Application } from '../../src/app/bootstrap/create-application.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import type { HttpServer } from '../../src/app/http/types.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('commerce foundation integration', () => {
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

  it('creates product, channel, price, offer, and reserves inventory', async () => {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const headers = authHeaders(user.accessToken);

    const marketplaceRes = await server.inject({
      method: 'POST',
      url: '/api/v1/marketplaces',
      headers,
      payload: { key: `mp_${Date.now()}`, name: 'Test Marketplace' },
    });
    expect(marketplaceRes.statusCode).toBe(201);
    const marketplaceId = marketplaceRes.json().data.id as string;

    const channelRes = await server.inject({
      method: 'POST',
      url: '/api/v1/channels',
      headers,
      payload: { marketplaceId, name: 'Main Channel' },
    });
    expect(channelRes.statusCode).toBe(201);
    const channelId = channelRes.json().data.id as string;

    const productRes = await server.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers,
      payload: { merchantSku: 'SKU-001', productType: 'STANDARD' },
    });
    expect(productRes.statusCode).toBe(201);
    const productId = productRes.json().data.id as string;

    const locationRes = await server.inject({
      method: 'POST',
      url: '/api/v1/stock-locations',
      headers,
      payload: { name: 'Warehouse A' },
    });
    expect(locationRes.statusCode).toBe(201);
    const stockLocationId = locationRes.json().data.id as string;

    const receiptRes = await server.inject({
      method: 'POST',
      url: '/api/v1/inventory/receipts',
      headers,
      payload: {
        stockLocationId,
        productId,
        quantity: 10,
        referenceType: 'TEST',
        referenceId: 'receipt-1',
      },
    });
    expect(receiptRes.statusCode).toBe(200);

    const priceRes = await server.inject({
      method: 'POST',
      url: '/api/v1/prices',
      headers,
      payload: {
        productId,
        channelId,
        currency: 'USD',
        amountMinor: 1999,
      },
    });
    expect(priceRes.statusCode).toBe(201);

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
    expect(activateRes.json().data.status).toBe('ACTIVE');

    const reserveRes = await server.inject({
      method: 'POST',
      url: '/api/v1/inventory/reservations',
      headers,
      payload: {
        stockLocationId,
        productId,
        quantity: 4,
        referenceType: 'TEST_ORDER',
        referenceId: 'order-1',
      },
    });
    expect(reserveRes.statusCode).toBe(200);

    const availabilityRes = await server.inject({
      method: 'GET',
      url: `/api/v1/inventory/${productId}`,
      headers,
    });
    expect(availabilityRes.statusCode).toBe(200);
    const balances = availabilityRes.json().data as Array<{ reserved: number; available: number }>;
    expect(balances.some((b) => b.reserved === 4 && b.available === 6)).toBe(true);
  });
});
