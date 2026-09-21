import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('authorization integration', () => {
  beforeAll(async () => {
    await getTestInfrastructure();
  });

  afterAll(async () => {
    await closeTestInfrastructure();
  });

  it('lists roles and effective permissions for owner', async () => {
    const infra = await getTestInfrastructure();
    const app = await createApplication(infra);
    await app.httpServer.ready();

    const tenant = await createTestTenant(app.httpServer);
    const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);

    const roles = await app.httpServer.inject({
      method: 'GET',
      url: '/api/v1/roles',
      headers: authHeaders(user.accessToken),
    });
    expect(roles.statusCode).toBe(200);
    expect(roles.json().data.length).toBeGreaterThanOrEqual(7);

    const permissions = await app.httpServer.inject({
      method: 'GET',
      url: `/api/v1/memberships/${user.membershipId}/roles`,
      headers: authHeaders(user.accessToken),
    });
    expect(permissions.statusCode).toBe(200);
    expect(permissions.json().data.permissions.length).toBeGreaterThan(0);

    await app.httpServer.close();
  });
});
