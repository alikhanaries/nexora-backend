import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Application } from '../../src/app/bootstrap/create-application.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import type { HttpServer } from '../../src/app/http/types.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('commerce inventory integration', () => {
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

  async function seedProductWithStock(availableQuantity: number) {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const headers = authHeaders(user.accessToken);

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
      payload: { name: 'Warehouse' },
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
        quantity: availableQuantity,
        referenceType: 'TEST',
        referenceId: `receipt-${Date.now()}`,
      },
    });
    expect(receiptRes.statusCode).toBe(200);

    return { headers, productId, stockLocationId };
  }

  it('prevents concurrent reservations from oversubscribing stock', async () => {
    const { headers, productId, stockLocationId } = await seedProductWithStock(5);

    const reservePayload = (referenceId: string, quantity: number) => ({
      method: 'POST' as const,
      url: '/api/v1/inventory/reservations',
      headers,
      payload: {
        stockLocationId,
        productId,
        quantity,
        referenceType: 'TEST_ORDER',
        referenceId,
      },
    });

    const [first, second] = await Promise.all([
      server.inject(reservePayload(`order-a-${Date.now()}`, 4)),
      server.inject(reservePayload(`order-b-${Date.now()}`, 3)),
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort();
    expect(statusCodes).toEqual([200, 422]);

    const availabilityRes = await server.inject({
      method: 'GET',
      url: `/api/v1/inventory/${productId}`,
      headers,
    });
    expect(availabilityRes.statusCode).toBe(200);
    const balances = availabilityRes.json().data as Array<{ reserved: number; available: number }>;
    const totalReserved = balances.reduce((sum, balance) => sum + balance.reserved, 0);
    expect(totalReserved).toBeLessThanOrEqual(5);
  });

  it('returns idempotent success for duplicate reservation references', async () => {
    const { headers, productId, stockLocationId } = await seedProductWithStock(10);
    const referenceId = `order-idempotent-${Date.now()}`;

    const payload = {
      stockLocationId,
      productId,
      quantity: 3,
      referenceType: 'TEST_ORDER',
      referenceId,
    };

    const first = await server.inject({
      method: 'POST',
      url: '/api/v1/inventory/reservations',
      headers,
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().data.idempotent).toBe(false);

    const second = await server.inject({
      method: 'POST',
      url: '/api/v1/inventory/reservations',
      headers,
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().data.idempotent).toBe(true);

    const availabilityRes = await server.inject({
      method: 'GET',
      url: `/api/v1/inventory/${productId}`,
      headers,
    });
    const balances = availabilityRes.json().data as Array<{ reserved: number }>;
    const totalReserved = balances.reduce((sum, balance) => sum + balance.reserved, 0);
    expect(totalReserved).toBe(3);
  });

  it('rejects release beyond reserved quantity and allows idempotent release', async () => {
    const { headers, productId, stockLocationId } = await seedProductWithStock(10);
    const referenceId = `order-release-${Date.now()}`;

    const reserveRes = await server.inject({
      method: 'POST',
      url: '/api/v1/inventory/reservations',
      headers,
      payload: {
        stockLocationId,
        productId,
        quantity: 4,
        referenceType: 'TEST_ORDER',
        referenceId,
      },
    });
    expect(reserveRes.statusCode).toBe(200);

    const overRelease = await server.inject({
      method: 'POST',
      url: '/api/v1/inventory/releases',
      headers,
      payload: {
        stockLocationId,
        productId,
        quantity: 5,
        referenceType: 'TEST_ORDER',
        referenceId,
      },
    });
    expect(overRelease.statusCode).toBe(422);

    const releaseRes = await server.inject({
      method: 'POST',
      url: '/api/v1/inventory/releases',
      headers,
      payload: {
        stockLocationId,
        productId,
        referenceType: 'TEST_ORDER',
        referenceId,
      },
    });
    expect(releaseRes.statusCode).toBe(200);
    expect(releaseRes.json().data.idempotent).toBe(false);

    const releaseAgain = await server.inject({
      method: 'POST',
      url: '/api/v1/inventory/releases',
      headers,
      payload: {
        stockLocationId,
        productId,
        referenceType: 'TEST_ORDER',
        referenceId,
      },
    });
    expect(releaseAgain.statusCode).toBe(200);
    expect(releaseAgain.json().data.idempotent).toBe(true);
  });
});
