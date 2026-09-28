import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { mapCoreErrorToExternalApiResponse } from '../../src/modules/compatibility/application/errors/map-core-error.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('StockConnect CE production readiness (Phase 52)', () => {
    let app;
    let server;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('readiness reports stockconnect_ce_compat probe (independent of optional storage check)', async () => {
        const response = await server.inject({ method: 'GET', url: '/health/ready' });
        expect(response.json().checks.stockconnect_ce_compat).toBe('ok');
    });

    it('does not expose internal details for unexpected CE errors', () => {
        const mapped = mapCoreErrorToExternalApiResponse(new Error('secret postgres://user:pass@host/db'));
        expect(mapped.statusCode).toBe(500);
        expect(mapped.body.Message).toBe('An error occurred');
        expect(JSON.stringify(mapped.body)).not.toContain('postgres://');
        expect(JSON.stringify(mapped.body)).not.toContain('stack');
    });
});
