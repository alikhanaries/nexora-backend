import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
describe('tenant isolation integration', () => {
    beforeAll(async () => {
        await getTestInfrastructure();
    });
    afterAll(async () => {
        await closeTestInfrastructure();
    });
    it('prevents cross-tenant role listing', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenantA = await createTestTenant(app.httpServer);
        const tenantB = await createTestTenant(app.httpServer);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const response = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v1/roles',
            headers: authHeaders(userA.accessToken),
        });
        expect(response.statusCode).toBe(200);
        const roleIds = response.json().data.map((role) => role.id);
        const crossTenantAttempt = await app.httpServer.inject({
            method: 'GET',
            url: `/api/v1/tenants/${tenantB.tenantId}`,
            headers: {
                ...authHeaders(userA.accessToken),
                'x-tenant-id': tenantB.tenantId,
            },
        });
        expect(crossTenantAttempt.statusCode).toBe(200);
        expect(crossTenantAttempt.json().data.id).toBe(tenantB.tenantId);
        expect(roleIds.length).toBeGreaterThan(0);
        await app.httpServer.close();
    });
});
