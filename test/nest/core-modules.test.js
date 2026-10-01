import request from 'supertest';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { noopMetricsRecorder } from '../../src/shared/metrics/index.js';
import { createTestNestApp } from './helpers/create-test-nest-app.js';

function createMockCoreDomain() {
  return {
    identity: {
      useCases: {
        login: { execute: jest.fn() },
        refreshToken: { execute: jest.fn() },
        logout: { execute: jest.fn() },
        getCurrentUser: { execute: jest.fn() },
      },
    },
    tenants: {
      useCases: {
        createTenant: { execute: jest.fn() },
        getTenant: { execute: jest.fn() },
        suspendTenant: { execute: jest.fn() },
        reactivateTenant: { execute: jest.fn() },
        closeTenant: { execute: jest.fn() },
      },
    },
    authenticateAccessToken: { execute: jest.fn() },
    verifyApiKey: { execute: jest.fn() },
    metrics: noopMetricsRecorder,
  };
}

describe('Nest core modules (auth + tenants)', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('POST /api/v1/auth/login is public and returns the standard envelope', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.identity.useCases.login.execute.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        tenantSlug: 'acme',
        email: 'user@example.com',
        password: 'secret',
      })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
      },
    });
    expect(coreDomain.identity.useCases.login.execute).toHaveBeenCalledWith({
      tenantSlug: 'acme',
      email: 'user@example.com',
      password: 'secret',
    });
  });

  it('GET /api/v1/auth/me requires authentication', async () => {
    const coreDomain = createMockCoreDomain();
    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    expect(response.body.success).toBe(false);
    expect(coreDomain.identity.useCases.getCurrentUser.execute).not.toHaveBeenCalled();
  });

  it('GET /api/v1/auth/me returns user data when Bearer token is valid', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue({
      kind: 'user',
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: '22222222-2222-4222-8222-222222222222',
      permissions: [],
      authenticationMethod: 'password',
      email: 'user@example.com',
    });
    coreDomain.identity.useCases.getCurrentUser.execute.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'user@example.com',
      status: 'active',
      tenantId: '22222222-2222-4222-8222-222222222222',
      membershipStatus: 'active',
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('user@example.com');
    expect(coreDomain.authenticateAccessToken.execute).toHaveBeenCalled();
    expect(coreDomain.identity.useCases.getCurrentUser.execute).toHaveBeenCalledWith({
      accessToken: 'test-token',
    });
  });

  it('POST /api/v1/tenants is public and returns 201', async () => {
    const coreDomain = createMockCoreDomain();
    const tenantId = '33333333-3333-4333-8333-333333333333';
    coreDomain.tenants.useCases.createTenant.execute.mockResolvedValue({
      tenant: {
        id: tenantId,
        slug: 'new-co',
        name: 'New Co',
        status: 'active',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        updatedAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .send({ slug: 'new-co', name: 'New Co' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(tenantId);
  });
});
