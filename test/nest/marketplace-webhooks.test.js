import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from '@jest/globals';
import { MarketplaceWebhookAuthenticationError } from '../../src/modules/webhooks/marketplace/services/marketplace-webhook-errors.js';
import { verifyShopifyStyleHmac } from '../../src/app/http/configure-express.js';
import { createTestNestApp } from './helpers/create-test-nest-app.js';
import { createMockCoreDomain } from './helpers/mock-core-domain.js';

const VALID_INGRESS_TOKEN = 'test-ingress-token-12345678';

describe('Nest marketplace webhooks module', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('POST /api/v1/inbound/marketplace-webhooks/:ingressToken is public (no bearer)', async () => {
    const coreServices = createMockCoreDomain();
    const created = await createTestNestApp({ coreServices });
    app = created.app;

    await request(app.getHttpServer())
      .post(`/api/v1/inbound/marketplace-webhooks/${VALID_INGRESS_TOKEN}`)
      .set('Content-Type', 'application/json')
      .send('{}')
      .expect(200);
  });

  it('returns success envelope with outcome and replayed flag', async () => {
    const coreServices = createMockCoreDomain();
    coreServices.marketplaceWebhookIngestion.receiveMarketplaceWebhook.execute.mockResolvedValue({
      data: { outcome: 'enqueued', externalOrderReference: 'ext-99' },
      replayed: false,
    });

    const created = await createTestNestApp({ coreServices });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/inbound/marketplace-webhooks/${VALID_INGRESS_TOKEN}`)
      .set('Content-Type', 'application/json')
      .send('{"order_id":1}')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { outcome: 'enqueued', externalOrderReference: 'ext-99' },
      replayed: false,
    });
  });

  it('passes ingress token, lower-cased headers, and raw body to the use case', async () => {
    const coreServices = createMockCoreDomain();
    const created = await createTestNestApp({ coreServices });
    app = created.app;

    const payload = '{"shop_id":1,"order_id":99}\n';
    await request(app.getHttpServer())
      .post(`/api/v1/inbound/marketplace-webhooks/${VALID_INGRESS_TOKEN}`)
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Hmac-Sha256', 'ignored-in-mock')
      .send(payload)
      .expect(200);

    expect(
      coreServices.marketplaceWebhookIngestion.receiveMarketplaceWebhook.execute,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        ingressToken: VALID_INGRESS_TOKEN,
        rawBody: payload,
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-shopify-hmac-sha256': 'ignored-in-mock',
        }),
      }),
    );
  });

  it('preserves raw bytes for Shopify-style HMAC verification helper', async () => {
    const payload = '{"shop_id":1,"order_id":99}\n';
    const secret = 'test-webhook-secret';
    const hmacHeader = createHmac('sha256', secret).update(payload, 'utf8').digest('base64');
    expect(verifyShopifyStyleHmac({ rawBody: payload, secret, hmacHeader })).toBe(true);
  });

  it('rejects ingress token shorter than 16 characters', async () => {
    const coreServices = createMockCoreDomain();
    const created = await createTestNestApp({ coreServices });
    app = created.app;

    await request(app.getHttpServer())
      .post('/api/v1/inbound/marketplace-webhooks/short')
      .set('Content-Type', 'application/json')
      .send('{}')
      .expect(400);

    expect(
      coreServices.marketplaceWebhookIngestion.receiveMarketplaceWebhook.execute,
    ).not.toHaveBeenCalled();
  });

  it('maps authentication failures from the use case to HTTP 401', async () => {
    const coreServices = createMockCoreDomain();
    coreServices.marketplaceWebhookIngestion.receiveMarketplaceWebhook.execute.mockRejectedValue(
      new MarketplaceWebhookAuthenticationError('invalid signature'),
    );

    const created = await createTestNestApp({ coreServices });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/inbound/marketplace-webhooks/${VALID_INGRESS_TOKEN}`)
      .set('Content-Type', 'application/json')
      .send('{}')
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  it('returns replayed true when idempotency replays the webhook', async () => {
    const coreServices = createMockCoreDomain();
    coreServices.marketplaceWebhookIngestion.receiveMarketplaceWebhook.execute.mockResolvedValue({
      data: { outcome: 'enqueued', externalOrderReference: 'order-dup' },
      replayed: true,
    });

    const created = await createTestNestApp({ coreServices });
    app = created.app;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/inbound/marketplace-webhooks/${VALID_INGRESS_TOKEN}`)
      .send('{"deduplicationKey":"k1"}')
      .expect(200);

    expect(response.body.replayed).toBe(true);
  });
});

describe('Marketplace webhook provider registration (existing adapters)', () => {
  it('registers Amazon, Namshi, Noon, and Shopify when runtime deps are supplied', async () => {
    const { MarketplaceWebhookAdapterRegistry } = await import(
      '../../src/modules/webhooks/marketplace/public/marketplace-webhook-adapter-registry.js'
    );
    const { registerMarketplaceWebhookAdapters } = await import(
      '../../src/modules/marketplaces/repositories/adapters/register-marketplace-webhook-adapters.js'
    );

    const registry = new MarketplaceWebhookAdapterRegistry();
    registerMarketplaceWebhookAdapters(registry, {
      marketplaceAdapterRuntimeFactory: {},
      commerceIntegrationQueryService: {},
      database: {},
      shopifyOrderAdapter: {},
    });

    const keys = registry.list().map((adapter) => adapter.marketplaceKey).sort();
    expect(keys).toEqual(['amazon', 'namshi', 'noon', 'shopify']);
  });
});
