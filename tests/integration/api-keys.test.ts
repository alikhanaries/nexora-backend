import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import {
  apiKeyHeaders,
  authHeaders,
  createAuthenticatedUser,
  createTestTenant,
} from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('api keys integration', () => {
  beforeAll(async () => {
    await getTestInfrastructure();
  });

  afterAll(async () => {
    await closeTestInfrastructure();
  });

  it('creates, lists, and authenticates with an API key', async () => {
    const infra = await getTestInfrastructure();
    const app = await createApplication(infra);
    await app.httpServer.ready();

    const tenant = await createTestTenant(app.httpServer);
    const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);

    const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
      tenantId: tenant.tenantId,
      actorPermissions: ['roles.read'],
      membershipId: user.membershipId,
    });

    const created = await app.apiKeys.useCases.createApiKey.execute({
      tenantId: tenant.tenantId,
      actorId: user.userId,
      actorPermissions: permissions.permissions,
      name: 'Integration key',
      scopes: ['orders.read', 'products.read'],
    });
    const secret = created.secret;

    const list = await app.httpServer.inject({
      method: 'GET',
      url: '/api/v1/api-keys',
      headers: authHeaders(user.accessToken),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.length).toBeGreaterThanOrEqual(1);

    const authed = await app.httpServer.inject({
      method: 'GET',
      url: '/api/v1/roles',
      headers: apiKeyHeaders(secret),
    });
    expect(authed.statusCode).toBe(403);

    await app.httpServer.close();
  });
});
