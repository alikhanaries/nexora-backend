import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { apiKeyHeaders, authHeaders, createAuthenticatedUser, createAuthenticatedUserWithSystemRole, createTestTenant, } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
describe('tenant lifecycle authorization integration', () => {
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
    it('allows an authorized same-tenant administrator to suspend and reactivate', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const suspend = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantId}/suspend`,
            headers: authHeaders(admin.accessToken),
        });
        expect(suspend.statusCode).toBe(200);
        expect(suspend.json().data.status).toBe('SUSPENDED');
        const reactivate = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantId}/reactivate`,
            headers: authHeaders(admin.accessToken),
        });
        expect(reactivate.statusCode).toBe(200);
        expect(reactivate.json().data.status).toBe('ACTIVE');
    });
    it('rejects lifecycle management from a low-privilege member', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'viewer');
        const response = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantId}/suspend`,
            headers: authHeaders(viewer.accessToken),
        });
        expect(response.statusCode).toBe(403);
    });
    it('rejects cross-tenant lifecycle management', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const adminA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const response = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantB.tenantId}/suspend`,
            headers: authHeaders(adminA.accessToken),
        });
        expect(response.statusCode).toBe(403);
        const tenantBState = await server.inject({
            method: 'GET',
            url: `/api/v1/tenants/${tenantB.tenantId}`,
        });
        expect(tenantBState.json().data.status).toBe('ACTIVE');
    });
    it('returns authorization failure for missing tenant.admin permission', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'viewer');
        const response = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantId}/close`,
            headers: authHeaders(viewer.accessToken),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe('FORBIDDEN');
    });
    it('rejects tenant lifecycle mutations from an API key without tenant.admin', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
            tenantId,
            actorPermissions: ['roles.read'],
            membershipId: admin.membershipId,
        });
        const created = await app.apiKeys.useCases.createApiKey.execute({
            tenantId,
            actorId: admin.userId,
            actorPermissions: permissions.permissions,
            name: 'Lifecycle read-only key',
            scopes: ['orders.read'],
        });
        const headers = apiKeyHeaders(created.secret);
        const suspend = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantId}/suspend`,
            headers,
        });
        expect(suspend.statusCode).toBe(403);
        const close = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantId}/close`,
            headers,
        });
        expect(close.statusCode).toBe(403);
        const tenantState = await server.inject({
            method: 'GET',
            url: `/api/v1/tenants/${tenantId}`,
        });
        expect(tenantState.json().data.status).toBe('ACTIVE');
    });
    it('allows tenant lifecycle mutations from an API key with tenant.admin on the same tenant', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
            tenantId,
            actorPermissions: ['roles.read'],
            membershipId: admin.membershipId,
        });
        const created = await app.apiKeys.useCases.createApiKey.execute({
            tenantId,
            actorId: admin.userId,
            actorPermissions: permissions.permissions,
            name: 'Lifecycle admin key',
            scopes: ['tenant.admin'],
        });
        const headers = apiKeyHeaders(created.secret);
        const suspend = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantId}/suspend`,
            headers,
        });
        expect(suspend.statusCode).toBe(200);
        expect(suspend.json().data.status).toBe('SUSPENDED');
        const reactivate = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantId}/reactivate`,
            headers,
        });
        expect(reactivate.statusCode).toBe(200);
        expect(reactivate.json().data.status).toBe('ACTIVE');
    });
    it('rejects cross-tenant lifecycle management from an API key', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const adminA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
            tenantId: tenantA.tenantId,
            actorPermissions: ['roles.read'],
            membershipId: adminA.membershipId,
        });
        const created = await app.apiKeys.useCases.createApiKey.execute({
            tenantId: tenantA.tenantId,
            actorId: adminA.userId,
            actorPermissions: permissions.permissions,
            name: 'Tenant A admin key',
            scopes: ['tenant.admin'],
        });
        const response = await server.inject({
            method: 'POST',
            url: `/api/v1/tenants/${tenantB.tenantId}/suspend`,
            headers: apiKeyHeaders(created.secret),
        });
        expect(response.statusCode).toBe(403);
        const tenantBState = await server.inject({
            method: 'GET',
            url: `/api/v1/tenants/${tenantB.tenantId}`,
        });
        expect(tenantBState.json().data.status).toBe('ACTIVE');
    });
});
