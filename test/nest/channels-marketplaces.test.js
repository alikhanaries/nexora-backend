import request from 'supertest';
import { afterEach, describe, expect, it } from '@jest/globals';
import { createTestNestApp } from './helpers/create-test-nest-app.js';
import { createMockCoreDomain } from './helpers/mock-core-domain.js';

const actorPrincipal = {
  kind: 'user',
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  permissions: ['channels:read'],
  authenticationMethod: 'password',
};

describe('Nest channels and marketplaces modules', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('GET /api/v1/channels requires authentication', async () => {
    const coreDomain = createMockCoreDomain();
    const created = await createTestNestApp({ coreDomain });
    app = created.app;
    await request(app.getHttpServer()).get('/api/v1/channels').expect(401);
  });

  it('GET /api/v1/channels returns list when authenticated', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/channels')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body).toEqual({ success: true, data: [] });
  });

  it('GET /api/v1/marketplaces requires authentication', async () => {
    const coreDomain = createMockCoreDomain();
    const created = await createTestNestApp({ coreDomain });
    app = created.app;
    await request(app.getHttpServer()).get('/api/v1/marketplaces').expect(401);
  });

  it('GET /api/v1/marketplaces returns list when authenticated', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/marketplaces')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body).toEqual({ success: true, data: [] });
  });

  it('DELETE /api/v1/channels/:channelId/marketplace-connection returns success only', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);
    coreDomain.channelRouteDeps.deleteMarketplaceConnection.execute.mockResolvedValue(undefined);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const channelId = '11111111-1111-4111-8111-111111111111';
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/channels/${channelId}/marketplace-connection`)
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body).toEqual({ success: true });
  });
});
