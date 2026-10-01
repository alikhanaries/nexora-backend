import { createHmac } from 'node:crypto';
import request from 'supertest';
import express from 'express';
import { afterEach, describe, expect, it } from '@jest/globals';
import { REQUEST_ID_HEADER } from '../../src/shared/context/request-id.js';
import { loadConfigFromEnvironment } from '../../src/app/config/index.js';
import {
  configureExpress,
  verifyShopifyStyleHmac,
} from '../../src/nest/bootstrap/configure-express.js';
import { NestDiagnosticsController } from './helpers/diagnostics.controller.js';
import { createTestNestApp } from './helpers/create-test-nest-app.js';

describe('NestJS Express foundation', () => {
  /** @type {import('@nestjs/common').INestApplication | undefined} */
  let app;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('creates a Nest application with the Express adapter', async () => {
    const created = await createTestNestApp();
    app = created.app;
    expect(app.getHttpAdapter().getType()).toBe('express');
  });

  it('GET /health/live returns the existing contract', async () => {
    const created = await createTestNestApp();
    app = created.app;
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns ready status without external infrastructure', async () => {
    const created = await createTestNestApp();
    app = created.app;
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.checks).toEqual({});
  });

  it('propagates or generates X-Request-Id', async () => {
    const created = await createTestNestApp();
    app = created.app;
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(response.headers[REQUEST_ID_HEADER.toLowerCase()]).toMatch(
      /^[A-Za-z0-9_-]{8,128}$/,
    );
  });

  it('returns the standard error envelope via GlobalExceptionFilter', async () => {
    const created = await createTestNestApp({
      extraControllers: [NestDiagnosticsController],
    });
    app = created.app;
    const response = await request(app.getHttpServer()).get('/__nest_test/error').expect(400);
    expect(response.body.success).toBe(false);
    expect(response.body.requestId).toEqual(expect.any(String));
    expect(response.body.error).toEqual(expect.objectContaining({ code: expect.any(String) }));
  });

  it('preserves exact raw bytes on marketplace webhook paths', async () => {
    const created = await createTestNestApp({
      extraControllers: [NestDiagnosticsController],
    });
    app = created.app;

    const payload = '{"shop_id":1,"order_id":99}\n';
    const secret = 'test-webhook-secret';
    const hmacHeader = createHmac('sha256', secret).update(payload, 'utf8').digest('base64');

    expect(verifyShopifyStyleHmac({ rawBody: payload, secret, hmacHeader })).toBe(true);

    const response = await request(app.getHttpServer())
      .post('/api/v1/inbound/marketplace-webhooks/test-ingress-token-12345678')
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);

    expect(response.body.rawBody).toBe(payload);
    expect(response.body.length).toBe(payload.length);
  });
});

describe('configureExpress marketplace raw body middleware', () => {
  it('captures bytes before JSON parsing on webhook paths only', async () => {
    const config = loadConfigFromEnvironment();
    const expressApp = express();
    configureExpress(expressApp, config);

    expressApp.post('/api/v1/inbound/marketplace-webhooks/:token', (req, res) => {
      res.status(200).json({ raw: req.marketplaceWebhookRawBody ?? null });
    });
    expressApp.post('/api/v1/other', express.json(), (req, res) => {
      res.status(200).json({ hasRaw: req.marketplaceWebhookRawBody !== undefined });
    });

    const payload = '{"a":1}';

    const webhook = await request(expressApp)
      .post('/api/v1/inbound/marketplace-webhooks/abc')
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);
    expect(webhook.body.raw).toBe('{"a":1}');

    const other = await request(expressApp)
      .post('/api/v1/other')
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);
    expect(other.body.hasRaw).toBe(false);
  });
});
