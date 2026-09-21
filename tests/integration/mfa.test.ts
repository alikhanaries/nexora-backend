import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('mfa integration', () => {
  beforeAll(async () => {
    await getTestInfrastructure();
  });

  afterAll(async () => {
    await closeTestInfrastructure();
  });

  it('starts TOTP enrollment for an authenticated user', async () => {
    const infra = await getTestInfrastructure();
    const app = await createApplication(infra);
    await app.httpServer.ready();

    const tenant = await createTestTenant(app.httpServer);
    const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);

    const start = await app.httpServer.inject({
      method: 'POST',
      url: '/api/v1/mfa/totp/start',
      headers: authHeaders(user.accessToken),
      payload: { label: 'Test authenticator' },
    });
    expect(start.statusCode).toBe(200);
    expect(start.json().data).toMatchObject({
      factorId: expect.any(String),
      otpauthUri: expect.stringContaining('otpauth://'),
    });

    await app.httpServer.close();
  });
});
