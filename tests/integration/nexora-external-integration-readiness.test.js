import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('Nexora external integration production readiness', () => {
    let server;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('readiness verifies infrastructure and external compatibility wiring without outbound consumer calls', async () => {
        const response = await server.inject({ method: 'GET', url: '/health/ready' });
        const checks = response.json().checks;
        expect(checks.postgres).toBe('ok');
        expect(checks.redis).toBe('ok');
        expect(checks.queue).toBe('ok');
        expect(checks.external_compat_ce_routes).toBe('ok');
    });

    it('rejects unauthenticated external compatibility order poll', async () => {
        const response = await server.inject({ method: 'GET', url: '/api/v2/ce/orders' });
        expect(response.statusCode).toBe(401);
    });
});
