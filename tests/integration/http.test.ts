import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('HTTP integration', () => {
  beforeAll(async () => {
    await getTestInfrastructure();
  });

  afterAll(async () => {
    await closeTestInfrastructure();
  });

  it('serves liveness, readiness, metrics and OpenAPI', async () => {
    const infra = await getTestInfrastructure();
    const app = await createApplication(infra);
    await app.httpServer.ready();

    const live = await app.httpServer.inject({ method: 'GET', url: '/health/live' });
    expect(live.statusCode).toBe(200);

    const ready = await app.httpServer.inject({ method: 'GET', url: '/health/ready' });
    expect(ready.statusCode).toBe(200);

    const metrics = await app.httpServer.inject({ method: 'GET', url: '/internal/metrics' });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.body).toContain('http_requests_total');

    const openapi = await app.httpServer.inject({ method: 'GET', url: '/openapi.json' });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json()).toMatchObject({ openapi: '3.1.0' });

    const ping = await app.httpServer.inject({ method: 'GET', url: '/api/v1/foundation/ping' });
    expect(ping.statusCode).toBe(200);
    expect(ping.json()).toEqual({ success: true, data: { message: 'pong' } });

    await app.httpServer.close();
  });
});
