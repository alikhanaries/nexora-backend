import request from 'supertest';
import { afterEach, describe, expect, it } from '@jest/globals';
import { createTestNestApp } from './helpers/create-test-nest-app.js';
import { createMockCoreDomain } from './helpers/mock-core-domain.js';

const actorPrincipal = {
  kind: 'user',
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenantId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  permissions: ['products:read'],
  authenticationMethod: 'password',
};

describe('Nest catalog modules (products, pricing, offers, inventory)', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('GET /api/v1/products requires authentication', async () => {
    const coreDomain = createMockCoreDomain();
    const created = await createTestNestApp({ coreDomain });
    app = created.app;
    await request(app.getHttpServer()).get('/api/v1/products').expect(401);
  });

  it('GET /api/v1/products returns paginated envelope when authenticated', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);
    coreDomain.products.useCases.listProducts.execute.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/products')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it('GET /api/v1/prices returns list envelope when authenticated', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/prices')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual([]);
  });

  it('GET /api/v1/offers requires authentication', async () => {
    const coreDomain = createMockCoreDomain();
    const created = await createTestNestApp({ coreDomain });
    app = created.app;
    await request(app.getHttpServer()).get('/api/v1/offers').expect(401);
  });

  it('GET /api/v1/stock-locations returns array when authenticated', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/stock-locations')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body).toEqual({ success: true, data: [] });
  });

  it('GET /api/v1/inventory returns balances array when authenticated', async () => {
    const coreDomain = createMockCoreDomain();
    coreDomain.authenticateAccessToken.execute.mockResolvedValue(actorPrincipal);

    const created = await createTestNestApp({ coreDomain });
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body).toEqual({ success: true, data: [] });
  });
});
