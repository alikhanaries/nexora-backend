import request from 'supertest';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createTestNestApp } from './helpers/create-test-nest-app.js';
import { createMockCoreDomain } from './helpers/mock-core-domain.js';

const membershipId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actorPrincipal = {
  kind: 'user',
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  permissions: ['roles:read'],
  authenticationMethod: 'password',
  email: 'admin@example.com',
  sessionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
};

describe('Nest feature modules (authorization, audit, api-keys, mfa)', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('GET /api/v1/permissions requires authentication', async () => {
    const coreDomain = createMockCoreDomain();
    const created = await createTestNestApp({ coreDomain });
    app = created.app;
    await request(app.getHttpServer()).get('/api/v1/permissions').expect(401);
  });

  it('GET /api/v1/permissions returns data when authenticated', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);
    coreDomain.authorization.routes.options.listPermissions.execute.mockResolvedValue([
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        key: 'roles:read',
        description: 'Read roles',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    ]);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/permissions')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data[0].key).toBe('roles:read');
  });

  it('GET /api/v1/audit lists events for authenticated tenant', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);
    coreDomain.audit.routes.options.auditService.listEvents.mockResolvedValue({
      total: 1,
      events: [
        {
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          tenantId: actorPrincipal.tenantId,
          actorKind: 'user',
          actorId: actorPrincipal.id,
          eventType: 'auth.login.success',
          resourceType: null,
          resourceId: null,
          metadata: {},
          ipAddress: '127.0.0.1',
          requestId: 'req-1',
          createdAt: new Date('2020-01-02T00:00:00.000Z'),
        },
      ],
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/audit')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.events).toHaveLength(1);
  });

  it('GET /api/v1/api-keys returns tenant keys when authenticated', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);
    coreDomain.apiKeys.useCases.listApiKeys.execute.mockResolvedValue([]);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/api-keys')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body).toEqual({ success: true, data: [] });
    expect(coreDomain.apiKeys.useCases.listApiKeys.execute).toHaveBeenCalled();
  });

  it('POST /api/v1/mfa/verify requires a user session', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue({
      kind: 'api-key',
      id: 'key-id',
      tenantId: actorPrincipal.tenantId,
      permissions: [],
      authenticationMethod: 'api-key',
      apiKeyId: 'key-id',
      scopes: [],
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post('/api/v1/mfa/verify')
      .set('Authorization', 'Bearer token')
      .send({ code: '123456' })
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  it('DELETE /api/v1/memberships/:membershipId/roles/:roleId returns removed envelope', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);
    coreDomain.authorization.routes.options.removeRole.execute.mockResolvedValue(undefined);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const roleId = '11111111-1111-4111-8111-111111111111';
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/memberships/${membershipId}/roles/${roleId}`)
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body).toEqual({ success: true, data: { removed: true } });
  });
});
