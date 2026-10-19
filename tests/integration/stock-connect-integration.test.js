import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/create-application.js';
import {
  apiKeyHeaders,
  authHeaders,
  createAuthenticatedUser,
  createTestTenant,
} from './auth-helpers.js';
import { createOrder, seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function createIntegrationApiKey(app, tenantId, user, scopes) {
  const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
    tenantId,
    actorPermissions: ['roles.read'],
    membershipId: user.membershipId,
  });
  return app.apiKeys.useCases.createApiKey.execute({
    tenantId,
    actorId: user.userId,
    actorPermissions: permissions.permissions,
    name: 'StockConnect integration key',
    scopes,
  });
}

describe('StockConnect integration API', () => {
  let app;
  let server;

  beforeAll(async () => {
    const infra = await getTestInfrastructure();
    app = await createApplication(infra);
    server = app.httpServer;
    await server.ready();
  });

  afterAll(async () => {
    await closeTestInfrastructure();
  });

  it('returns 401 without credentials on ping', async () => {
    const response = await server.inject({ method: 'GET', url: '/api/v2/stock-connect/ping' });
    expect(response.statusCode).toBe(401);
  });

  it('accepts Bearer service token (nxk_ API key)', async () => {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const apiKey = await createIntegrationApiKey(app, tenantId, user, ['orders.read']);
    const response = await server.inject({
      method: 'GET',
      url: '/api/v2/stock-connect/ping',
      headers: { authorization: `Bearer ${apiKey.secret}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().integration).toBe('stock-connect');
  });

  it('enforces tenant isolation for orders', async () => {
    const tenantA = await createTestTenant(server);
    const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
    const keyA = await createIntegrationApiKey(app, tenantA.tenantId, userA, [
      'orders.read',
      'products.read',
    ]);
    const fixtureA = await seedCommerceFixture(server, authHeaders(userA.accessToken));
    const orderA = await createOrder(server, authHeaders(userA.accessToken), fixtureA);

    const tenantB = await createTestTenant(server);
    const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
    const keyB = await createIntegrationApiKey(app, tenantB.tenantId, userB, ['orders.read']);

    const crossTenant = await server.inject({
      method: 'GET',
      url: `/api/v2/stock-connect/orders/${orderA.id}`,
      headers: apiKeyHeaders(keyB.secret),
    });
    expect(crossTenant.statusCode).toBe(404);

    const ownTenant = await server.inject({
      method: 'GET',
      url: `/api/v2/stock-connect/orders/${orderA.id}`,
      headers: apiKeyHeaders(keyA.secret),
    });
    expect(ownTenant.statusCode).toBe(200);
    expect(ownTenant.json().data.id).toBe(orderA.id);
  });

  it('lists products and resolves by merchantSku', async () => {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const apiKey = await createIntegrationApiKey(app, tenantId, user, ['products.read']);
    const fixture = await seedCommerceFixture(server, authHeaders(user.accessToken));

    const bySku = await server.inject({
      method: 'GET',
      url: `/api/v2/stock-connect/products?merchantSku=${encodeURIComponent(fixture.merchantSku)}`,
      headers: apiKeyHeaders(apiKey.secret),
    });
    expect(bySku.statusCode).toBe(200);
    expect(bySku.json().data.items).toHaveLength(1);
    expect(bySku.json().data.items[0].merchantSku).toBe(fixture.merchantSku);

    const list = await server.inject({
      method: 'GET',
      url: '/api/v2/stock-connect/products?limit=10',
      headers: apiKeyHeaders(apiKey.secret),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.items.length).toBeGreaterThan(0);
  });

  it('rejects mismatched X-Tenant-Id', async () => {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const apiKey = await createIntegrationApiKey(app, tenantId, user, ['orders.read']);
    const response = await server.inject({
      method: 'GET',
      url: '/api/v2/stock-connect/ping',
      headers: {
        ...apiKeyHeaders(apiKey.secret),
        'x-tenant-id': '00000000-0000-4000-8000-000000000000',
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it('supports order sync listing with updatedAfter filter', async () => {
    const { tenantId, slug } = await createTestTenant(server);
    const user = await createAuthenticatedUser(app, tenantId, slug);
    const apiKey = await createIntegrationApiKey(app, tenantId, user, ['orders.read']);
    const fixture = await seedCommerceFixture(server, authHeaders(user.accessToken));
    await createOrder(server, authHeaders(user.accessToken), fixture, `ext-${Date.now()}`);

    const sync = await server.inject({
      method: 'GET',
      url: `/api/v2/stock-connect/orders/sync?limit=5&updatedAfter=${encodeURIComponent(new Date(0).toISOString())}`,
      headers: apiKeyHeaders(apiKey.secret),
    });
    expect(sync.statusCode).toBe(200);
    expect(sync.json().data.sync).toBeDefined();
    expect(Array.isArray(sync.json().data.items)).toBe(true);
  });
});
