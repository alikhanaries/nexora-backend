import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
describe('commerce tenant isolation integration', () => {
    let app;
    let server;
    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
    });
    afterAll(async () => {
        await closeTestInfrastructure();
    });
    it('prevents tenant B from reading tenant A products', async () => {
        const tenantA = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const productRes = await server.inject({
            method: 'POST',
            url: '/api/v1/products',
            headers: authHeaders(userA.accessToken),
            payload: { merchantSku: 'ISOLATED-SKU', productType: 'STANDARD' },
        });
        expect(productRes.statusCode).toBe(201);
        const productId = productRes.json().data.id;
        const tenantB = await createTestTenant(server);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/products/${productId}`,
            headers: authHeaders(userB.accessToken),
        });
        expect(getRes.statusCode).toBe(404);
    });
});
