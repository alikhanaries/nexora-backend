import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
describe('auth flow integration', () => {
    beforeAll(async () => {
        await getTestInfrastructure();
    });
    afterAll(async () => {
        await closeTestInfrastructure();
    });
    it('logs in, returns current user, refreshes and logs out', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const me = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v1/auth/me',
            headers: authHeaders(user.accessToken),
        });
        expect(me.statusCode).toBe(200);
        expect(me.json().data).toMatchObject({
            id: user.userId,
            email: user.email,
            tenantId: tenant.tenantId,
            membershipStatus: 'ACTIVE',
        });
        const refresh = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/auth/refresh',
            payload: { refreshToken: user.refreshToken },
        });
        expect(refresh.statusCode).toBe(200);
        const refreshed = refresh.json().data;
        const logout = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/auth/logout',
            payload: { refreshToken: refreshed.refreshToken },
        });
        expect(logout.statusCode).toBe(200);
        await app.httpServer.close();
    });
    it('rejects protected routes without credentials', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const response = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v1/auth/me',
        });
        expect(response.statusCode).toBe(401);
        await app.httpServer.close();
    });
});
